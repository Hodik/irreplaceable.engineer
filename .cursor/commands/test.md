Write comprehensive tests for the specified code/feature/bug fix.

1. **MUST ALWAYS Read @docs/testing.md** to understand how to write/execute tests
2. First check for existing tests for a subject and if possible - extend them to cover new use cases. And only if don't exist or it doesn't make sense to expand them - create new tests.
3. **Run tests** to verify they pass

Refer to `docs/testing.md` for:
- Unit vs Integration test guidelines and when to use each
- Coverage checklist and required scenarios to cover

## After Writing Tests

1. Run newely created tests to verify they pass
2. Check test execution time (unit tests must be instant)
3. If tests fail, fix the code or the test UNTILL THEY PASS
4. Run ALL tests for ALL apps and verify they pass too, never skip/delete/remove failing tests even if they are not related to changes made. 