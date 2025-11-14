# nestjs-redlock-universal

> NestJS integration for [redlock-universal](https://www.npmjs.com/package/redlock-universal) - Distributed Redis locks with decorators and dependency injection

[![npm version](https://img.shields.io/npm/v/nestjs-redlock-universal.svg)](https://www.npmjs.com/package/nestjs-redlock-universal)
[![npm downloads](https://img.shields.io/npm/dm/nestjs-redlock-universal.svg)](https://www.npmjs.com/package/nestjs-redlock-universal)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

NestJS wrapper for [redlock-universal](https://www.npmjs.com/package/redlock-universal), providing **distributed Redis locks** through NestJS decorators, modules, and dependency injection.

## Features

- **NestJS Native**: First-class integration with dependency injection and lifecycle hooks
- **Distributed Locks**: Redlock algorithm for multi-instance Redis setups
- **Simple API**: Method decorator for zero-boilerplate distributed locking
- **High Performance**: <1ms lock acquisition with automatic extension
- **Type-Safe**: Full TypeScript support with strict type checking
- **Universal**: Works with both `node-redis` v4+ and `ioredis` v5+ clients

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Advanced Usage](#advanced-usage)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Installation

This package wraps `redlock-universal`, so you need to install both packages:

```bash
npm install nestjs-redlock-universal redlock-universal
```

You'll also need a Redis client:

```bash
# For node-redis
npm install redis

# OR for ioredis
npm install ioredis
```

## Quick Start

### 1. Configure the Module

```typescript
import { Module } from '@nestjs/common';
import { RedlockModule } from 'nestjs-redlock-universal';
import { NodeRedisAdapter } from 'redlock-universal';
import { createClient } from 'redis';

// Create and connect Redis clients
const redis1 = createClient({ url: 'redis://localhost:6379' });
const redis2 = createClient({ url: 'redis://localhost:6380' });
const redis3 = createClient({ url: 'redis://localhost:6381' });

await Promise.all([redis1.connect(), redis2.connect(), redis3.connect()]);

@Module({
  imports: [
    RedlockModule.forRoot({
      nodes: [
        new NodeRedisAdapter(redis1),
        new NodeRedisAdapter(redis2),
        new NodeRedisAdapter(redis3),
      ],
      defaultTtl: 30000, // 30 seconds
    }),
  ],
})
export class AppModule {}
```

### 2. Use the `@Redlock` Decorator

```typescript
import { Injectable } from '@nestjs/common';
import { Redlock } from 'nestjs-redlock-universal';

@Injectable()
export class PaymentService {
  @Redlock({ key: 'payment:processing' })
  async processPayment(orderId: string): Promise<void> {
    // This method is automatically protected by a distributed lock
    // Only one instance can execute at a time across all servers
  }

  @Redlock({ key: (userId: string) => `user:${userId}:update` })
  async updateUser(userId: string, data: unknown): Promise<void> {
    // Lock key is dynamically generated from method arguments
    // Each user gets their own lock
  }
}
```

### 3. Or Use the Service Directly

```typescript
import { Injectable } from '@nestjs/common';
import { RedlockService } from 'nestjs-redlock-universal';

@Injectable()
export class OrderService {
  constructor(private readonly redlock: RedlockService) {}

  async processOrder(orderId: string): Promise<void> {
    // Recommended: Automatic lock management with using()
    await this.redlock.using(`order:${orderId}`, async () => {
      // Lock is automatically extended if operation takes longer than TTL
      // Lock is automatically released when done or on error
    });
  }

  async manualLocking(resourceId: string): Promise<void> {
    // Advanced: Manual acquire/release for fine-grained control
    const handle = await this.redlock.acquire(`resource:${resourceId}`);
    try {
      // Critical section
    } finally {
      await this.redlock.release(`resource:${resourceId}`, handle);
    }
  }
}
```

## Configuration

### Synchronous Configuration

```typescript
import { RedlockModule } from 'nestjs-redlock-universal';
import { NodeRedisAdapter } from 'redlock-universal';

RedlockModule.forRoot({
  nodes: [
    new NodeRedisAdapter(redis1),
    new NodeRedisAdapter(redis2),
    new NodeRedisAdapter(redis3),
  ],
  defaultTtl: 30000,        // Default lock TTL in milliseconds
  retryAttempts: 3,         // Number of retry attempts
  retryDelay: 200,          // Delay between retries in milliseconds
  quorum: 2,                // Minimum nodes for quorum (default: majority)
  logger: winstonLogger,    // Optional: Winston, Pino, or Bunyan logger
})
```

### Asynchronous Configuration

```typescript
import { ConfigService } from '@nestjs/config';

RedlockModule.forRootAsync({
  useFactory: async (configService: ConfigService) => {
    const redisUrls = configService.get<string[]>('redis.urls');
    const clients = await Promise.all(
      redisUrls.map(url => createClient({ url }).connect())
    );

    return {
      nodes: clients.map(client => new NodeRedisAdapter(client)),
      defaultTtl: configService.get('redis.lockTtl', 30000),
    };
  },
  inject: [ConfigService],
})
```

### Using ioredis

```typescript
import { IoredisAdapter } from 'redlock-universal';
import Redis from 'ioredis';

const redis1 = new Redis({ host: 'localhost', port: 6379 });
const redis2 = new Redis({ host: 'localhost', port: 6380 });
const redis3 = new Redis({ host: 'localhost', port: 6381 });

RedlockModule.forRoot({
  nodes: [
    new IoredisAdapter(redis1),
    new IoredisAdapter(redis2),
    new IoredisAdapter(redis3),
  ],
})
```

### Logger Integration

The module supports external loggers for lock operations. Winston works directly, while Pino and Bunyan require adapters:

#### Winston (Direct Support)

```typescript
import * as winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

RedlockModule.forRoot({
  nodes: [new NodeRedisAdapter(redis1)],
  logger, // Winston works directly
})
```

#### Pino (Requires Adapter)

```typescript
import pino from 'pino';
import { createPinoAdapter } from 'redlock-universal';

const pinoLogger = pino({ level: 'info' });
const logger = createPinoAdapter(pinoLogger);

RedlockModule.forRoot({
  nodes: [new NodeRedisAdapter(redis1)],
  logger,
})
```

#### Bunyan (Requires Adapter)

```typescript
import * as bunyan from 'bunyan';
import { createBunyanAdapter } from 'redlock-universal';

const bunyanLogger = bunyan.createLogger({ name: 'myapp', level: 'info' });
const logger = createBunyanAdapter(bunyanLogger);

RedlockModule.forRoot({
  nodes: [new NodeRedisAdapter(redis1)],
  logger,
})
```

**Supported Loggers:**

| Logger          | Works Directly | Adapter Needed               |
| --------------- | -------------- | ---------------------------- |
| Winston         | ✅ Yes         | No                           |
| Pino            | ⚠️ Via Adapter | `createPinoAdapter()`        |
| Bunyan          | ⚠️ Via Adapter | `createBunyanAdapter()`      |

## API Reference

### `@Redlock` Decorator

Automatically wraps a method with lock acquisition and release.

```typescript
@Redlock(options: RedlockDecoratorOptions)

interface RedlockDecoratorOptions {
  // Static key or function that generates key from arguments
  key: string | ((...args: unknown[]) => string);
  // Lock time-to-live in milliseconds (default: module defaultTtl)
  ttl?: number;
  // Number of retry attempts (default: module retryAttempts)
  retryAttempts?: number;
  // Delay between retries in milliseconds (default: module retryDelay)
  retryDelay?: number;
}
```

**Examples:**

```typescript
// Static key
@Redlock({ key: 'global:config:update' })
async updateConfig() { }

// Dynamic key from arguments
@Redlock({ key: (id: string) => `resource:${id}:lock` })
async updateResource(id: string) { }

// Custom TTL
@Redlock({ key: 'long:operation', ttl: 300000 }) // 5 minutes
async longRunningTask() { }

// Multiple arguments
@Redlock({ key: (type: string, id: string) => `${type}:${id}:lock` })
async process(type: string, id: string) { }
```

### `RedlockService`

Injectable service for programmatic lock management.

#### `acquire(key: string, ttl?: number): Promise<LockHandle>`

Acquire a lock manually. Returns a handle that must be passed to `release()`.

```typescript
const handle = await redlockService.acquire('resource:123');
try {
  // Critical section
} finally {
  await redlockService.release('resource:123', handle);
}
```

#### `release(key: string, handle: LockHandle): Promise<void>`

Release a previously acquired lock using its handle.

#### `using<T>(key: string, fn: (signal?: AbortSignal) => Promise<T>, ttl?: number): Promise<T>`

Execute a function with automatic lock management. **Recommended for most use cases.**

```typescript
const result = await redlockService.using('resource:123', async (signal) => {
  // Lock is automatically acquired, extended, and released

  // Optional: Check if lock extension failed
  if (signal?.aborted) {
    throw new Error('Lock lost during operation');
  }

  return processResource();
});
```

## Advanced Usage

### Accessing Advanced Features

For advanced features like batch operations, health checks, and metrics, import directly from `redlock-universal`:

```typescript
import { RedlockService } from 'nestjs-redlock-universal';
import { LockManager, HealthChecker, MetricsCollector } from 'redlock-universal';

@Injectable()
export class AdvancedService {
  constructor(private readonly redlock: RedlockService) {}

  async batchOperations() {
    // Use redlock-universal directly for batch locks
    const manager = new LockManager({ nodes: [...] });
    const handles = await manager.acquireBatch(['key1', 'key2', 'key3']);
    // ... process
    await manager.releaseBatch(handles);
  }
}
```

### Single-Node Setup (Development)

For development or single-instance deployments:

```typescript
const redis = createClient({ url: 'redis://localhost:6379' });
await redis.connect();

RedlockModule.forRoot({
  nodes: [new NodeRedisAdapter(redis)],
  // Automatically uses SimpleLock instead of RedLock for single node
})
```

### Lock Key Best Practices

```typescript
// ✅ Good: Specific, hierarchical keys
@Redlock({ key: (userId) => `user:${userId}:profile:update` })

// ✅ Good: Include resource type
@Redlock({ key: (orderId) => `order:${orderId}:payment` })

// ❌ Bad: Too generic
@Redlock({ key: 'update' })

// ❌ Bad: No namespace
@Redlock({ key: (id) => id })
```

## Lock Strategy Selection

The module automatically selects the optimal lock strategy:

- **1-2 nodes**: Uses `SimpleLock` (single-instance locking)
- **3+ nodes**: Uses `RedLock` (distributed Redlock algorithm)

For production deployments, always use **3 or more Redis instances** for proper fault tolerance.

## Testing

### Mocking in Tests

```typescript
import { Test } from '@nestjs/testing';
import { RedlockService } from 'nestjs-redlock-universal';

const module = await Test.createTestingModule({
  providers: [
    YourService,
    {
      provide: RedlockService,
      useValue: {
        using: vi.fn((key, fn) => fn()),
        acquire: vi.fn(),
        release: vi.fn(),
      },
    },
  ],
}).compile();
```

### Integration Testing

See [TESTING.md](./TESTING.md) for complete integration testing guide with Docker.

## Performance

Based on `redlock-universal` benchmarks:

- **Acquisition latency**: <1ms mean (P95: <2ms)
- **Throughput**: 3,300+ ops/sec (single node)
- **Batch operations**: 500+ ops/sec (10-lock batches)
- **Memory**: <2KB per lock operation

## Common Use Cases

### 1. Prevent Duplicate Processing

```typescript
@Redlock({ key: (jobId) => `job:${jobId}:process` })
async processJob(jobId: string) {
  // Ensures only one worker processes this job
}
```

### 2. Exclusive Resource Access

```typescript
@Redlock({ key: (userId) => `user:${userId}:wallet` })
async updateWallet(userId: string, amount: number) {
  // Prevents race conditions in balance updates
}
```

### 3. Rate Limiting Critical Operations

```typescript
@Redlock({ key: 'api:external:call', ttl: 1000 })
async callRateLimitedAPI() {
  // Ensures max 1 call per second across all instances
}
```

### 4. Coordinated Cache Invalidation

```typescript
@Redlock({ key: 'cache:rebuild' })
async rebuildCache() {
  // Only one instance rebuilds cache at a time
}
```

## Troubleshooting

### Lock Acquisition Fails

**Problem**: `LockAcquisitionError: Failed to acquire lock`

**Solutions**:
- Check Redis connectivity: Ensure all nodes are reachable
- Verify quorum settings: Need majority of nodes (or configured quorum)
- Check lock contention: Another process may hold the lock
- Increase retry attempts or delay in configuration

### Lock Released Too Early

**Problem**: Lock expires during long operation

**Solutions**:
- Use `using()` method instead of manual `acquire()`/`release()` - it auto-extends
- Increase `defaultTtl` in module configuration
- Check if operation can be split into smaller atomic operations

### Memory Leaks

**Problem**: Memory usage grows over time

**Solutions**:
- Ensure proper module cleanup (we handle this automatically via `onModuleDestroy`)
- Check for uncaught errors that prevent lock release
- Use `using()` method to guarantee cleanup

### Module Not Initializing

**Problem**: `LockManager not initialized` error

**Solutions**:
- Ensure Redis clients are connected before module initialization
- Check for errors in `forRootAsync` factory function
- Verify `onModuleInit` lifecycle hook completes successfully

For more help, see:
- [redlock-universal documentation](https://www.npmjs.com/package/redlock-universal)
- [Report an issue](https://github.com/alexpota/nestjs-redlock-universal/issues)

## Why nestjs-redlock-universal?

### vs. Raw Redis SET NX

❌ Manual lock release
❌ No automatic extension
❌ No distributed consensus
❌ Race conditions in cleanup

✅ Automatic lifecycle management
✅ Auto-extension for long operations
✅ Distributed locking with quorum
✅ Enhanced error handling

### vs. Other NestJS Redis Libraries

Most NestJS Redis libraries focus on caching. This library is purpose-built for **distributed locking**:

- ✅ Redlock algorithm implementation
- ✅ Automatic lock extension via `using()`
- ✅ NestJS decorator for zero-boilerplate
- ✅ Built on `redlock-universal`
- ✅ Universal Redis client support (node-redis + ioredis)

## License

MIT

## Related Projects

- [redlock-universal](https://www.npmjs.com/package/redlock-universal) - The underlying distributed lock library

## Contributing

Issues and pull requests are welcome! Please see our [contributing guidelines](./CONTRIBUTING.md).

## Support

- [Report bugs](https://github.com/alexpota/nestjs-redlock-universal/issues)
- [Request features](https://github.com/alexpota/nestjs-redlock-universal/issues)
- [Documentation](https://github.com/alexpota/nestjs-redlock-universal#readme)
- [Star on GitHub](https://github.com/alexpota/nestjs-redlock-universal)
