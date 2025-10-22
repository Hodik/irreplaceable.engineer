# Code Review

Review code changes for critical issues only. 
Not only review the diff itself, but go deep into the context code to understand how it works underneath so that you can find real problems and vulnerabilities.

## Get Changes

Use git read commands:
- `git status` - see modified files
- `git diff` - unstaged changes
- `git diff --staged` - staged changes  
- `git diff main...HEAD` - all branch changes vs main
- `git log -p -n 5` - recent commits with diffs

## Check Patterns

Reference `@docs.mdc` to understand existing patterns and conventions. Identify if changes break established:
- Architectural patterns
- Design decisions
- Naming conventions, code formatting
- Module relationships

## Review Criteria

Focus on **critical issues only**:
- **Bugs** - Logic errors, null handling, edge cases
- **Performance** - N+1 queries, inefficient algorithms, memory leaks
- **Security** - SQL injection, XSS, auth bypasses, data exposure
- **Correctness** - Business logic errors, data integrity violations
- **Pattern Breaks** - Violations of established architectural patterns or conventions

## Output Format

**If critical issues found:**
```
⚠️ ISSUES FOUND

- [Brief critical issue]
- [Brief critical issue]
```

**If no critical issues:**
```
✅ APPROVED

No critical issues. Ready to merge.
```

Skip minor style issues, nitpicks, or non-critical suggestions.

