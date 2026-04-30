interface Env {
  POSTHOG_PROJECT_KEY: string;
  POSTHOG_API_HOST: string;
  WHOP_API_BASE: string;
  WHOP_PLAN_ID: string;
  ALLOWED_ORIGIN: string;
  WHOP_WEBHOOK_SECRET: string;
  WHOP_API_KEY: string;
}

const REPLAY_TOLERANCE_S = 5 * 60;

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/create-checkout") {
      return handleCreateCheckout(req, env);
    }
    if (url.pathname === "/webhook") {
      return handleWebhook(req, env, ctx);
    }
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }
    return new Response("not found", { status: 404 });
  },
};

// --------------------------------------------------------------------------
// /create-checkout — called from lab.astro on pricing-CTA click
// --------------------------------------------------------------------------

async function handleCreateCheckout(req: Request, env: Env): Promise<Response> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = isAllowedOrigin(origin, env.ALLOWED_ORIGIN);
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allowed) corsHeaders["Access-Control-Allow-Origin"] = origin;

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, corsHeaders);
  }

  let body: CreateCheckoutBody;
  try {
    body = (await req.json()) as CreateCheckoutBody;
  } catch {
    return json({ error: "invalid_json" }, 400, corsHeaders);
  }

  if (!body.posthog_distinct_id || typeof body.posthog_distinct_id !== "string") {
    return json({ error: "missing_distinct_id" }, 400, corsHeaders);
  }

  const metadata: Record<string, string> = {
    posthog_distinct_id: body.posthog_distinct_id,
  };
  for (const k of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "referrer",
    "referring_domain",
    "landing_path",
  ] as const) {
    const v = body[k];
    if (typeof v === "string" && v.length > 0) {
      metadata[k] = v.slice(0, 500);
    }
  }

  const whopRes = await fetch(`${env.WHOP_API_BASE}/checkout_configurations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WHOP_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      plan_id: env.WHOP_PLAN_ID,
      metadata,
      allow_promo_codes: true,
      source_url: `${env.ALLOWED_ORIGIN}/lab`,
    }),
  });

  if (!whopRes.ok) {
    const text = await whopRes.text();
    console.error(
      `[create-checkout] whop ${whopRes.status}: ${text.slice(0, 500)}`,
    );
    return json({ error: "checkout_creation_failed" }, 502, corsHeaders);
  }

  const config = (await whopRes.json()) as {
    id?: string;
    purchase_url?: string;
    metadata?: Record<string, string> | null;
  };
  if (!config.purchase_url) {
    console.error(`[create-checkout] whop response missing purchase_url`);
    return json({ error: "checkout_creation_failed" }, 502, corsHeaders);
  }

  // Log what Whop stored so we can verify metadata round-trip without a real purchase.
  console.log(
    `[create-checkout] session=${config.id} metadata_stored=${JSON.stringify(config.metadata ?? null)}`,
  );

  let absolute = config.purchase_url.startsWith("http")
    ? config.purchase_url
    : `https://whop.com${config.purchase_url}`;

  if (body.promo_code) {
    const u = new URL(absolute);
    u.searchParams.set("promoCode", body.promo_code);
    absolute = u.toString();
  }

  return json({ url: absolute }, 200, corsHeaders);
}

interface CreateCheckoutBody {
  posthog_distinct_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
  referring_domain?: string;
  landing_path?: string;
  promo_code?: string;
}

// --------------------------------------------------------------------------
// /webhook — called by Whop on payment.succeeded / membership.* events
// --------------------------------------------------------------------------

async function handleWebhook(
  req: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const id = req.headers.get("webhook-id");
  const ts = req.headers.get("webhook-timestamp");
  const sig = req.headers.get("webhook-signature");
  if (!id || !ts || !sig) {
    return new Response("missing webhook headers", { status: 400 });
  }

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) {
    return new Response("bad timestamp", { status: 400 });
  }
  const nowS = Math.floor(Date.now() / 1000);
  if (Math.abs(nowS - tsNum) > REPLAY_TOLERANCE_S) {
    console.warn(`[webhook] stale timestamp: now=${nowS} ts=${tsNum}`);
    return new Response("stale", { status: 400 });
  }

  const rawBody = await req.text();

  if (!env.WHOP_WEBHOOK_SECRET) {
    console.error(`[webhook] secret not configured`);
    return new Response("server misconfigured", { status: 500 });
  }

  // Whop signs with the entire secret string (e.g. "ws_xxxxx") used as raw UTF-8 HMAC key bytes.
  const keyBytes = new TextEncoder().encode(env.WHOP_WEBHOOK_SECRET);
  const expected = await computeSignature(keyBytes, `${id}.${ts}.${rawBody}`);

  // webhook-signature may contain multiple space-separated entries: "v1,<sig> v1,<sig>"
  const entries = sig.split(" ").map((s) => s.trim()).filter(Boolean);
  let matched = false;
  for (const entry of entries) {
    const [scheme, value] = entry.split(",", 2);
    if (scheme !== "v1" || !value) continue;
    if (timingSafeEqual(value, expected)) {
      matched = true;
      break;
    }
  }
  if (!matched) {
    console.warn(`[webhook] signature mismatch for id=${id}`);
    return new Response("invalid signature", { status: 401 });
  }

  let envelope: WhopWebhook;
  try {
    envelope = JSON.parse(rawBody) as WhopWebhook;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  // Always ack 200 to Whop (don't make them retry over PostHog hiccups).
  // Forward to PostHog in the background.
  ctx.waitUntil(forwardToPostHog(envelope, env));

  return new Response("ok", { status: 200 });
}

async function forwardToPostHog(envelope: WhopWebhook, env: Env): Promise<void> {
  const event = mapEnvelopeToEvent(envelope);
  if (!event) {
    console.log(`[webhook] ignoring type=${envelope.type}`);
    return;
  }

  const res = await fetch(`${env.POSTHOG_API_HOST}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: env.POSTHOG_PROJECT_KEY,
      event: event.name,
      distinct_id: event.distinct_id,
      properties: event.properties,
      timestamp: envelope.timestamp,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(
      `[webhook] posthog ${res.status} for ${envelope.id}: ${text.slice(0, 300)}`,
    );
  } else {
    console.log(
      `[webhook] verified ${envelope.type} → posthog 200 (${event.name}, did=${event.distinct_id})`,
    );
  }
}

interface MappedEvent {
  name: string;
  distinct_id: string;
  properties: Record<string, unknown>;
}

function mapEnvelopeToEvent(envelope: WhopWebhook): MappedEvent | null {
  const data = envelope.data as Record<string, any> | undefined;
  if (!data) return null;

  const metadata = (data.metadata ?? {}) as Record<string, string>;
  const distinctId =
    metadata.posthog_distinct_id ||
    data.user?.email ||
    data.user?.id ||
    `whop_${data.id}`;

  const baseProps: Record<string, unknown> = {
    $insert_id: envelope.id,
    whop_event_id: envelope.id,
    whop_company_id: envelope.company_id,
    utm_source: metadata.utm_source,
    utm_medium: metadata.utm_medium,
    utm_campaign: metadata.utm_campaign,
    utm_content: metadata.utm_content,
    utm_term: metadata.utm_term,
    referrer: metadata.referrer,
    referring_domain: metadata.referring_domain,
    landing_path: metadata.landing_path,
  };

  if (envelope.type === "payment.succeeded") {
    const isRenewal =
      typeof data.billing_reason === "string" &&
      /renew/i.test(data.billing_reason);
    return {
      name: isRenewal ? "subscription_renewed" : "purchase_completed",
      distinct_id: distinctId,
      properties: {
        ...baseProps,
        amount: data.total,
        amount_subtotal: data.subtotal,
        amount_usd: data.usd_total,
        currency: data.currency,
        tax_amount: data.tax_amount,
        plan_id: data.plan?.id,
        product_id: data.product?.id,
        product_title: data.product?.title,
        payment_id: data.id,
        billing_reason: data.billing_reason,
        promo_code: data.promo_code?.code ?? null,
        promo_amount_off: data.promo_code?.amount_off ?? null,
        user_email: data.user?.email,
        whop_user_id: data.user?.id,
      },
    };
  }

  if (envelope.type === "membership.deactivated") {
    return {
      name: "subscription_canceled",
      distinct_id: distinctId,
      properties: {
        ...baseProps,
        membership_id: data.id,
        plan_id: data.plan?.id,
        product_id: data.product?.id,
        whop_user_id: data.user?.id,
        canceled_at: data.canceled_at,
        cancel_option: data.cancel_option,
        cancellation_reason: data.cancellation_reason,
      },
    };
  }

  // membership.activated and anything else: ignored
  return null;
}

interface WhopWebhook {
  id: string;
  api_version: string;
  company_id: string | null;
  timestamp: string;
  type: string;
  data: unknown;
}

// --------------------------------------------------------------------------
// Crypto helpers
// --------------------------------------------------------------------------


async function computeSignature(
  keyBytes: Uint8Array,
  message: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const bytes = new Uint8Array(sig);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// --------------------------------------------------------------------------

function json(
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

function isAllowedOrigin(origin: string, configured: string): boolean {
  if (!origin) return false;
  if (origin === configured) return true;
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
  } catch {}
  return false;
}
