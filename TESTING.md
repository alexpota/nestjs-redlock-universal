# Testing Guide

This package includes both **unit tests** (mocked) and **integration tests** (real Redis).

## Quick Start

```bash
# Run unit tests (fast, no dependencies)
npm test

# Run integration tests (requires Docker)
npm run test:e2e

# Run with coverage
npm run test:coverage
```

## Unit Tests

Unit tests use mocked Redis adapters and focus on testing the NestJS integration layer.

**Location**: Colocated with source files (`*.spec.ts`)
- `src/service/redlock.service.spec.ts` - 13 tests
- `src/module/redlock.module.spec.ts` - 11 tests
- `src/decorators/redlock.decorator.spec.ts` - 11 tests

**Run**: `npm test`

**Coverage**: ~79% (target: 70%+)

## Integration Tests

Integration tests use real Redis instances via Docker to verify actual distributed locking behavior.

**Location**: `test/integration.test.ts`

**What They Test**:
- ✅ Real Redis lock acquisition and release
- ✅ Distributed RedLock algorithm with 3 nodes
- ✅ Lock contention and concurrent access prevention
- ✅ `@Redlock` decorator with real Redis
- ✅ `using()` method with automatic management
- ✅ Error handling and lock cleanup

### Prerequisites

1. **Docker** must be installed and running
2. Ports 6379, 6380, 6381 must be available

### Running Integration Tests

```bash
# Start Redis containers, run tests, clean up
npm run test:e2e

# Or manually:
npm run docker:up        # Start 3 Redis instances
npm run test:integration # Run integration tests
npm run docker:down      # Stop and remove containers
```

### Docker Setup

The `docker-compose.yml` file defines 3 Redis instances for RedLock testing:

- **redis1**: localhost:6379
- **redis2**: localhost:6380
- **redis3**: localhost:6381

### Troubleshooting

**Error: "Cannot connect to Redis"**
- Ensure Docker is running: `docker ps`
- Check ports are not in use: `lsof -i :6379`
- Wait for health checks: `docker compose ps`

**Error: "docker-credential-desktop not found"**
- Fix Docker Desktop credentials configuration
- Or pull images manually: `docker pull redis:7-alpine`

**Tests fail intermittently**
- Increase wait times in docker:up script
- Check Redis is fully started: `docker logs nestjs-redlock-universal-redis1-1`

## Test Philosophy

Following `redlock-universal`'s approach:

- **70% Integration Tests**: Test real behavior with actual Redis
- **20% Unit Tests**: Test pure logic and NestJS DI
- **10% E2E Tests**: Test full application scenarios

## CI/CD Integration

For GitHub Actions / CI pipelines:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      redis1:
        image: redis:7-alpine
        ports:
          - 6379:6379
      redis2:
        image: redis:7-alpine
        ports:
          - 6380:6379
      redis3:
        image: redis:7-alpine
        ports:
          - 6381:6379

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - run: npm ci
      - run: npm test              # Unit tests
      - run: npm run test:integration  # Integration tests
```

## Writing Tests

### Unit Test Example

```typescript
it('should acquire a lock', async () => {
  const mockAdapter = {
    setNX: vi.fn().mockResolvedValue('OK'),
    // ... other mocks
  };

  const module = await Test.createTestingModule({
    imports: [RedlockModule.forRoot({ nodes: [mockAdapter] })],
  }).compile();

  const service = module.get<RedlockService>(RedlockService);
  const handle = await service.acquire('test:lock');

  expect(handle).toBeDefined();
});
```

### Integration Test Example

```typescript
it('should prevent concurrent access', async () => {
  let executionOrder = [];

  const task1 = redlockService.using('key', async () => {
    executionOrder.push(1);
    await new Promise(resolve => setTimeout(resolve, 50));
    executionOrder.push(2);
  });

  const task2 = redlockService.using('key', async () => {
    executionOrder.push(3);
  });

  await Promise.all([task1, task2]);

  // task2 waited for task1 to finish
  expect(executionOrder).toEqual([1, 2, 3]);
});
```

## Test Maintenance

- **Before releasing**: Run full test suite including integration tests
- **After major changes**: Verify both unit and integration tests pass
- **Coverage threshold**: Maintain >70% coverage
- **Integration tests**: Run before each npm publish

## Performance Benchmarks

Expected performance with real Redis:

- Lock acquisition: <2ms (P95)
- Lock release: <1ms (P95)
- Using() overhead: <5ms (P95)
- 3-node RedLock: <10ms (P95)
