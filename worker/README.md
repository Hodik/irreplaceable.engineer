# lab-checkout worker

Cloudflare Worker that:

1. **`POST /create-checkout`** — called by `src/pages/lab.astro`. Creates a Whop checkout configuration with the visitor's PostHog `distinct_id` and UTM/referrer attribution as `metadata`, returns the resulting `purchase_url`.
2. **`POST /webhook`** — called by Whop. Verifies Standard-Webhooks signature, extracts the metadata we attached at checkout-creation time, forwards the event to PostHog so the conversion stitches onto the same person who viewed the landing page.

Repo can stay public. Secrets are stored in Cloudflare's encrypted secret store via `wrangler secret put`, never committed.

## First-time setup

Prereqs: a Cloudflare account (free tier) and a Whop account with API access.

```sh
cd worker
npm install
npx wrangler login                          # opens browser, signs in to Cloudflare
npx wrangler secret put WHOP_WEBHOOK_SECRET # paste whsk_... from Whop webhook UI
npx wrangler secret put WHOP_API_KEY        # paste Bearer token from Whop dashboard
npx wrangler deploy                         # ships to <name>.<account>.workers.dev
```

Note the deployed Worker URL (printed at the end of `deploy`). It looks like
`https://lab-checkout.<your-account>.workers.dev`.

### Wire up the landing page

In `src/pages/lab.astro`, set the `WORKER_URL` constant near the inline checkout script
to the deployed URL above. Push to `main`; GitHub Pages redeploys.

### Wire up Whop

In Whop dashboard:

1. **Webhooks** → Add endpoint → URL = `<worker-url>/webhook`. Subscribe to:
   - `payment.succeeded` (primary — carries amount + plan)
   - `membership.activated` (subscribed but ignored by Worker)
   - `membership.deactivated` (emits `subscription_canceled`)
   Copy the signing secret (`whsk_...`) into `wrangler secret put WHOP_WEBHOOK_SECRET`.
2. **Developers / API keys** → create one with scopes:
   `checkout_configuration:create`, `plan:create`, `access_pass:create`,
   `access_pass:update`, `checkout_configuration:basic:read`.
   Paste into `wrangler secret put WHOP_API_KEY`.

## Local dev

```sh
echo 'WHOP_WEBHOOK_SECRET="whsk_dGVzdHNlY3JldA=="' >> .dev.vars
echo 'WHOP_API_KEY="<test-key>"' >> .dev.vars
npx wrangler dev
```

`.dev.vars` is git-ignored. Use the `whsk_dGVzdHNlY3JldA==` value above for offline
signature-verification tests; for end-to-end tests use the real Whop test secret.

### Testing the webhook signature

Standard Webhooks signs `${webhook-id}.${webhook-timestamp}.${rawBody}` with HMAC-SHA-256
using the base64-decoded portion of `whsk_<base64>`, and base64-encodes the result.

```sh
node -e '
  const crypto = require("crypto");
  const secret = Buffer.from("dGVzdHNlY3JldA==", "base64");
  const id = "msg_test_001";
  const ts = Math.floor(Date.now()/1000).toString();
  const body = JSON.stringify({ id, api_version: "v1", company_id: "biz_test",
    timestamp: new Date().toISOString(), type: "payment.succeeded",
    data: { id: "pay_test", status: "paid", currency: "usd", subtotal: 49,
      total: 49, usd_total: 49, plan: { id: "plan_test" },
      product: { id: "prod_test", title: "The Lab" },
      user: { id: "user_test", email: "test@example.com" },
      billing_reason: "initial",
      metadata: { posthog_distinct_id: "test_visitor", utm_source: "youtube",
                  utm_content: "video_abc" } } });
  const sig = crypto.createHmac("sha256", secret).update(`${id}.${ts}.${body}`).digest("base64");
  console.log(`curl -X POST http://localhost:8787/webhook \\
    -H "webhook-id: ${id}" -H "webhook-timestamp: ${ts}" -H "webhook-signature: v1,${sig}" \\
    -H "content-type: application/json" --data ${JSON.stringify(body)}`);
'
```

Pipe the output to `bash` to fire it. Expect:
- Worker log: `[webhook] verified payment.succeeded → posthog 200`
- PostHog Live events: `purchase_completed` for `distinct_id=test_visitor`.

To verify rejection of bad signatures, flip a byte and re-curl — Worker should return 401.

## Production deploy

```sh
npx wrangler deploy
```

Cloudflare keeps prior deploys for instant rollback (`wrangler rollback` or via dashboard).

## Cost

Free tier: 100k requests/day. At any realistic traffic level for this funnel, $0/mo.
