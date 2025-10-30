Write comprehensive tests for the specified code/feature/bug fix.

## Workflow

1. **MUST ALWAYS Read @docs/testing.md** to understand how to write/execute tests
2. First check for existing tests for a subject and if possible - extend them to cover new use cases. And only if don't exist or it doesn't make sense to expand them - create new tests.
3. **Run tests** to verify they pass

## Testing Pyramid

Follow the testing pyramid approach - focus on unit tests at the base, with fewer integration tests at the top:

**Unit Tests (Foundation)**:

- Test single function/method/component in isolation
- Must be instant - fast feedback loop
- Mock all external dependencies (databases, APIs, file systems, services)
- **Follow FIRST Principles**:
  - **Fast**: Tests run in milliseconds
  - **Independent**: No dependencies between tests, can run in any order
  - **Repeatable**: Same result every time, no flaky tests
  - **Self-Validating**: Clear pass/fail, no manual inspection needed
  - **Timely**: Written alongside or before implementation code

**Integration Tests (Top Layer)**:

- Test how components work together, full workflows
- Slower, more expensive to run
- Mock only external services (3rd party APIs, external systems)
- Cover critical user journeys, main business flows

Refer to `docs/testing.md` for project-specific patterns:

- Test framework and runner configuration
- Fixtures and setup patterns
- Mocking approaches for the tech stack
- How to run tests in the project

## After Writing Tests

1. Run newely created tests to verify they pass
2. Check test execution time (unit tests must be instant)
3. If tests fail, fix the code or the test UNTILL THEY PASS
4. Run ALL tests for ALL apps and verify they pass too, never skip/delete/remove failing tests even if they are not related to changes made.
