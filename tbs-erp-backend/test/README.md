# Testing Guide

## Overview

This project uses Jest as the testing framework. Tests are located alongside the source code with `.spec.ts` extension.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run specific test file
npm test -- auth.service.spec.ts
```

## Test Structure

```
src/
  core/
    auth/
      auth.service.ts
      auth.service.spec.ts  ← Test file next to source
  modules/
    order/
      order.service.ts
      order.service.spec.ts
```

## Writing Tests

### Unit Tests

Test individual functions and methods in isolation:

```typescript
describe('AuthService', () => {
  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      // Arrange - Set up test data and mocks
      // Act - Call the method being tested
      // Assert - Verify the results
    });
  });
});
```

### Integration Tests

Test multiple components working together:

```typescript
describe('Auth Flow (Integration)', () => {
  it('should login, refresh token, and logout', async () => {
    // Test the full authentication flow
  });
});
```

## Test Coverage Goals

- **Critical paths**: 100% coverage (auth, payments, orders)
- **Business logic**: 80%+ coverage
- **API controllers**: 70%+ coverage
- **Utilities**: 90%+ coverage

## Mocking

### Mocking Prisma

```typescript
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};
```

### Mocking External Services

```typescript
jest.mock('./external-api.service', () => ({
  ExternalApiService: jest.fn().mockImplementation(() => ({
    fetchData: jest.fn().mockResolvedValue({ data: 'mocked' }),
  })),
}));
```

## Best Practices

1. **Test behavior, not implementation** - Focus on what the code does, not how
2. **Use descriptive test names** - `should throw error when email is invalid`
3. **Arrange-Act-Assert pattern** - Structure your tests clearly
4. **Mock external dependencies** - Database, APIs, file system
5. **Clean up after tests** - Use `afterEach` to reset mocks
6. **Test edge cases** - Null values, empty arrays, invalid input
7. **Keep tests fast** - Mock slow operations
8. **One assertion per test** - Makes failures easier to debug

## Common Patterns

### Testing async code

```typescript
it('should handle async operations', async () => {
  const result = await service.asyncMethod();
  expect(result).toBeDefined();
});
```

### Testing exceptions

```typescript
it('should throw error for invalid input', async () => {
  await expect(service.method(invalidInput)).rejects.toThrow(BadRequestException);
});
```

### Testing with timers

```typescript
jest.useFakeTimers();
// ... test code
jest.advanceTimersByTime(1000);
jest.useRealTimers();
```

## Continuous Integration

Tests run automatically on:
- Every commit (pre-commit hook)
- Pull requests (CI/CD pipeline)
- Before deployment

## Troubleshooting

### Tests timing out

Increase timeout in specific test:
```typescript
it('should handle long operation', async () => {
  // ...
}, 10000); // 10 second timeout
```

### Flaky tests

- Use `jest.setTimeout()` for slow operations
- Ensure proper cleanup in `afterEach`
- Check for race conditions
- Mock time-dependent code

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [NestJS Testing Guide](https://docs.nestjs.com/fundamentals/testing)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
