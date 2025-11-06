import { Test, TestingModule } from '@nestjs/testing';
import { Injectable } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Redlock } from './redlock.decorator';
import { RedlockModule } from '../module/redlock.module';
import { RedlockService } from '../service/redlock.service';
import type { RedisAdapter } from 'redlock-universal';

describe('@Redlock Decorator', () => {
  let mockAdapter: RedisAdapter;

  beforeEach(() => {
    mockAdapter = {
      setNX: vi.fn().mockResolvedValue('OK'),
      get: vi.fn(),
      del: vi.fn(),
      delIfMatch: vi.fn().mockResolvedValue(true),
      extendIfMatch: vi.fn(),
      atomicExtend: vi.fn(),
      batchSetNX: vi.fn(),
      ping: vi.fn().mockResolvedValue('PONG'),
      isConnected: vi.fn().mockReturnValue(true),
      disconnect: vi.fn(),
    } as unknown as RedisAdapter;
  });

  describe('static key', () => {
    it('should protect method with static lock key', async () => {
      @Injectable()
      class TestService {
        @Redlock({ key: 'static:test:lock' })
        async protectedMethod(): Promise<string> {
          return 'success';
        }
      }

      const module: TestingModule = await Test.createTestingModule({
        imports: [RedlockModule.forRoot({ nodes: [mockAdapter] })],
        providers: [TestService],
      }).compile();

      await module.init();

      const testService = module.get<TestService>(TestService);
      const result = await testService.protectedMethod();

      expect(result).toBe('success');
      expect(mockAdapter.setNX).toHaveBeenCalled();
    });

    it('should use custom TTL when provided', async () => {
      @Injectable()
      class TestService {
        @Redlock({ key: 'test:lock', ttl: 60000 })
        async protectedMethod(): Promise<string> {
          return 'success';
        }
      }

      const module: TestingModule = await Test.createTestingModule({
        imports: [RedlockModule.forRoot({ nodes: [mockAdapter] })],
        providers: [TestService],
      }).compile();

      await module.init();

      const testService = module.get<TestService>(TestService);
      const result = await testService.protectedMethod();

      expect(result).toBe('success');
    });
  });

  describe('dynamic key', () => {
    it('should generate lock key from arguments', async () => {
      @Injectable()
      class TestService {
        @Redlock({ key: (userId: string) => `user:${userId}:lock` })
        async updateUser(userId: string, _data: object): Promise<string> {
          return `updated-${userId}`;
        }
      }

      const module: TestingModule = await Test.createTestingModule({
        imports: [RedlockModule.forRoot({ nodes: [mockAdapter] })],
        providers: [TestService],
      }).compile();

      await module.init();

      const testService = module.get<TestService>(TestService);
      const result = await testService.updateUser('123', { name: 'John' });

      expect(result).toBe('updated-123');
      expect(mockAdapter.setNX).toHaveBeenCalled();
    });

    it('should handle multiple arguments in key generator', async () => {
      @Injectable()
      class TestService {
        @Redlock({ key: (type: string, id: string) => `${type}:${id}:lock` })
        async processResource(type: string, id: string): Promise<string> {
          return `${type}-${id}`;
        }
      }

      const module: TestingModule = await Test.createTestingModule({
        imports: [RedlockModule.forRoot({ nodes: [mockAdapter] })],
        providers: [TestService],
      }).compile();

      await module.init();

      const testService = module.get<TestService>(TestService);
      const result = await testService.processResource('payment', '456');

      expect(result).toBe('payment-456');
    });
  });

  describe('error handling', () => {
    it('should throw error if key generator returns invalid key', async () => {
      @Injectable()
      class TestService {
        @Redlock({ key: () => '' })
        async protectedMethod(): Promise<string> {
          return 'success';
        }
      }

      const module: TestingModule = await Test.createTestingModule({
        imports: [RedlockModule.forRoot({ nodes: [mockAdapter] })],
        providers: [TestService],
      }).compile();

      await module.init();

      const testService = module.get<TestService>(TestService);

      await expect(testService.protectedMethod()).rejects.toThrow(
        'Lock key must be a non-empty string'
      );
    });

    it('should throw error if key generator returns non-string', async () => {
      @Injectable()
      class TestService {
        @Redlock({ key: (() => 123) as unknown as () => string })
        async protectedMethod(): Promise<string> {
          return 'success';
        }
      }

      const module: TestingModule = await Test.createTestingModule({
        imports: [RedlockModule.forRoot({ nodes: [mockAdapter] })],
        providers: [TestService],
      }).compile();

      await module.init();

      const testService = module.get<TestService>(TestService);

      await expect(testService.protectedMethod()).rejects.toThrow(
        'Lock key must be a non-empty string'
      );
    });

    it('should propagate errors from protected method', async () => {
      @Injectable()
      class TestService {
        @Redlock({ key: 'test:lock' })
        async failingMethod(): Promise<string> {
          throw new Error('Method failed');
        }
      }

      const module: TestingModule = await Test.createTestingModule({
        imports: [RedlockModule.forRoot({ nodes: [mockAdapter] })],
        providers: [TestService],
      }).compile();

      await module.init();

      const testService = module.get<TestService>(TestService);

      await expect(testService.failingMethod()).rejects.toThrow('Method failed');
    });

    it('should release lock even when method throws', async () => {
      @Injectable()
      class TestService {
        @Redlock({ key: 'test:lock' })
        async failingMethod(): Promise<string> {
          throw new Error('Test error');
        }
      }

      const module: TestingModule = await Test.createTestingModule({
        imports: [RedlockModule.forRoot({ nodes: [mockAdapter] })],
        providers: [TestService],
      }).compile();

      await module.init();

      const testService = module.get<TestService>(TestService);

      await expect(testService.failingMethod()).rejects.toThrow('Test error');
      expect(mockAdapter.setNX).toHaveBeenCalled();
    });
  });

  describe('context preservation', () => {
    it('should preserve method context (this binding)', async () => {
      @Injectable()
      class TestService {
        private value = 'instance-value';

        @Redlock({ key: 'test:lock' })
        async getValue(): Promise<string> {
          return this.value;
        }
      }

      const module: TestingModule = await Test.createTestingModule({
        imports: [RedlockModule.forRoot({ nodes: [mockAdapter] })],
        providers: [TestService],
      }).compile();

      await module.init();

      const testService = module.get<TestService>(TestService);
      const result = await testService.getValue();

      expect(result).toBe('instance-value');
    });

    it('should pass through all method arguments', async () => {
      @Injectable()
      class TestService {
        @Redlock({ key: 'test:lock' })
        async methodWithMultipleArgs(a: number, b: string, c: boolean): Promise<string> {
          return `${a}-${b}-${c}`;
        }
      }

      const module: TestingModule = await Test.createTestingModule({
        imports: [RedlockModule.forRoot({ nodes: [mockAdapter] })],
        providers: [TestService],
      }).compile();

      await module.init();

      const testService = module.get<TestService>(TestService);
      const result = await testService.methodWithMultipleArgs(42, 'test', true);

      expect(result).toBe('42-test-true');
    });
  });

  describe('integration with RedlockService', () => {
    it('should use RedlockService.using() for automatic lock management', async () => {
      const usingSpy = vi.fn().mockImplementation(async (_key, fn) => fn());

      @Injectable()
      class TestService {
        @Redlock({ key: 'test:lock' })
        async protectedMethod(): Promise<string> {
          return 'success';
        }
      }

      const module: TestingModule = await Test.createTestingModule({
        imports: [RedlockModule.forRoot({ nodes: [mockAdapter] })],
        providers: [TestService],
      })
        .overrideProvider(RedlockService)
        .useValue({
          using: usingSpy,
        })
        .compile();

      await module.init();

      const testService = module.get<TestService>(TestService);
      await testService.protectedMethod();

      expect(usingSpy).toHaveBeenCalledWith('test:lock', expect.any(Function), {});
    });

    it('should pass custom retryAttempts to RedlockService.using()', async () => {
      const usingSpy = vi.fn().mockImplementation(async (_key, fn) => fn());

      @Injectable()
      class TestService {
        @Redlock({ key: 'test:lock', retryAttempts: 5 })
        async protectedMethod(): Promise<string> {
          return 'success';
        }
      }

      const module: TestingModule = await Test.createTestingModule({
        imports: [RedlockModule.forRoot({ nodes: [mockAdapter] })],
        providers: [TestService],
      })
        .overrideProvider(RedlockService)
        .useValue({
          using: usingSpy,
        })
        .compile();

      await module.init();

      const testService = module.get<TestService>(TestService);
      await testService.protectedMethod();

      expect(usingSpy).toHaveBeenCalledWith('test:lock', expect.any(Function), {
        retryAttempts: 5,
      });
    });

    it('should pass custom retryDelay to RedlockService.using()', async () => {
      const usingSpy = vi.fn().mockImplementation(async (_key, fn) => fn());

      @Injectable()
      class TestService {
        @Redlock({ key: 'test:lock', retryDelay: 500 })
        async protectedMethod(): Promise<string> {
          return 'success';
        }
      }

      const module: TestingModule = await Test.createTestingModule({
        imports: [RedlockModule.forRoot({ nodes: [mockAdapter] })],
        providers: [TestService],
      })
        .overrideProvider(RedlockService)
        .useValue({
          using: usingSpy,
        })
        .compile();

      await module.init();

      const testService = module.get<TestService>(TestService);
      await testService.protectedMethod();

      expect(usingSpy).toHaveBeenCalledWith('test:lock', expect.any(Function), {
        retryDelay: 500,
      });
    });

    it('should pass all custom options (ttl, retryAttempts, retryDelay) to RedlockService.using()', async () => {
      const usingSpy = vi.fn().mockImplementation(async (_key, fn) => fn());

      @Injectable()
      class TestService {
        @Redlock({ key: 'test:lock', ttl: 60000, retryAttempts: 5, retryDelay: 500 })
        async protectedMethod(): Promise<string> {
          return 'success';
        }
      }

      const module: TestingModule = await Test.createTestingModule({
        imports: [RedlockModule.forRoot({ nodes: [mockAdapter] })],
        providers: [TestService],
      })
        .overrideProvider(RedlockService)
        .useValue({
          using: usingSpy,
        })
        .compile();

      await module.init();

      const testService = module.get<TestService>(TestService);
      await testService.protectedMethod();

      expect(usingSpy).toHaveBeenCalledWith('test:lock', expect.any(Function), {
        ttl: 60000,
        retryAttempts: 5,
        retryDelay: 500,
      });
    });
  });
});
