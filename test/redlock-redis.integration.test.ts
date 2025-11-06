import { Test, TestingModule } from '@nestjs/testing';
import { Injectable } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from 'redis';
import { NodeRedisAdapter } from 'redlock-universal';
import { RedlockModule, RedlockService, Redlock } from '../src';

describe('Integration Tests (Real Redis)', () => {
  let module: TestingModule;
  let redlockService: RedlockService;
  let testService: TestService;
  let redis1: ReturnType<typeof createClient>;
  let redis2: ReturnType<typeof createClient>;
  let redis3: ReturnType<typeof createClient>;

  @Injectable()
  class TestService {
    counter = 0;

    @Redlock({ key: 'test:counter', ttl: 5000 })
    async incrementCounter(): Promise<number> {
      const current = this.counter;
      await new Promise(resolve => setTimeout(resolve, 10));
      this.counter = current + 1;
      return this.counter;
    }

    @Redlock({ key: (id: string) => `test:user:${id}` })
    async processUser(id: string): Promise<string> {
      return `processed-${id}`;
    }
  }

  beforeAll(async () => {
    redis1 = createClient({ url: 'redis://localhost:6379' });
    redis2 = createClient({ url: 'redis://localhost:6380' });
    redis3 = createClient({ url: 'redis://localhost:6381' });

    await Promise.all([redis1.connect(), redis2.connect(), redis3.connect()]);

    module = await Test.createTestingModule({
      imports: [
        RedlockModule.forRoot({
          nodes: [
            new NodeRedisAdapter(redis1),
            new NodeRedisAdapter(redis2),
            new NodeRedisAdapter(redis3),
          ],
          defaultTtl: 5000,
        }),
      ],
      providers: [TestService],
    }).compile();

    await module.init();

    redlockService = module.get<RedlockService>(RedlockService);
    testService = module.get<TestService>(TestService);
  });

  afterAll(async () => {
    // module.close() will call onModuleDestroy which disconnects Redis clients
    await module?.close();
  });

  describe('RedlockService Direct Usage', () => {
    it('should acquire and release a lock', async () => {
      const handle = await redlockService.acquire('integration:test:1');

      expect(handle).toBeDefined();
      expect(handle.key).toBe('integration:test:1');
      expect(handle.value).toBeDefined();

      await redlockService.release('integration:test:1', handle);
    });

    it('should prevent concurrent access with using()', async () => {
      let executionOrder: number[] = [];

      const task1 = redlockService.using('integration:test:2', async () => {
        executionOrder.push(1);
        await new Promise(resolve => setTimeout(resolve, 50));
        executionOrder.push(2);
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const task2 = redlockService.using('integration:test:2', async () => {
        executionOrder.push(3);
        await new Promise(resolve => setTimeout(resolve, 50));
        executionOrder.push(4);
      });

      await Promise.all([task1, task2]);

      expect(executionOrder).toEqual([1, 2, 3, 4]);
    });

    it('should return function result from using()', async () => {
      const result = await redlockService.using('integration:test:3', async () => {
        return { success: true, value: 42 };
      });

      expect(result).toEqual({ success: true, value: 42 });
    });
  });

  describe('@Redlock Decorator', () => {
    it('should protect method with static key', async () => {
      testService.counter = 0;

      const results = await Promise.all([
        testService.incrementCounter(),
        testService.incrementCounter(),
        testService.incrementCounter(),
      ]);

      expect(testService.counter).toBe(3);
      expect(results).toEqual([1, 2, 3]);
    });

    it('should protect method with dynamic key', async () => {
      const result1 = await testService.processUser('123');
      const result2 = await testService.processUser('456');

      expect(result1).toBe('processed-123');
      expect(result2).toBe('processed-456');
    });

    it('should allow concurrent access to different keys', async () => {
      const startTime = Date.now();

      await Promise.all([
        testService.processUser('user-1'),
        testService.processUser('user-2'),
        testService.processUser('user-3'),
      ]);

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('Multi-Node RedLock', () => {
    it('should successfully acquire lock with 3 nodes', async () => {
      const handle = await redlockService.acquire('integration:multinode:1');

      expect(handle.metadata?.strategy).toBe('redlock');

      await redlockService.release('integration:multinode:1', handle);
    });

    it('should handle lock contention correctly', async () => {
      let winner: string | null = null;

      const task1 = (async () => {
        try {
          await redlockService.using('integration:contention:1', async () => {
            if (!winner) winner = 'task1';
            await new Promise(resolve => setTimeout(resolve, 100));
          });
        } catch {
          // Expected to fail if task2 wins
        }
      })();

      const task2 = (async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        try {
          await redlockService.using('integration:contention:1', async () => {
            if (!winner) winner = 'task2';
            await new Promise(resolve => setTimeout(resolve, 100));
          });
        } catch {
          // Expected to fail if task1 wins
        }
      })();

      await Promise.all([task1, task2]);

      expect(winner).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should release lock even if function throws', async () => {
      await expect(
        redlockService.using('integration:error:1', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      const handle = await redlockService.acquire('integration:error:1');
      expect(handle).toBeDefined();
      await redlockService.release('integration:error:1', handle);
    });
  });
});
