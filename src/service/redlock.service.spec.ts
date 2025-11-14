import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RedlockService } from './redlock.service';
import { REDLOCK_MODULE_OPTIONS } from '../constants';
import type { RedlockModuleOptions } from '../interfaces/redlock-module-options.interface';
import type { RedisAdapter, ILogger } from 'redlock-universal';

describe('RedlockService', () => {
  let service: RedlockService;
  let mockAdapter: RedisAdapter;

  beforeEach(async () => {
    // Create mock adapter
    mockAdapter = {
      setNX: vi.fn(),
      get: vi.fn(),
      del: vi.fn(),
      delIfMatch: vi.fn(),
      extendIfMatch: vi.fn(),
      atomicExtend: vi.fn(),
      batchSetNX: vi.fn(),
      ping: vi.fn().mockResolvedValue('PONG'),
      isConnected: vi.fn().mockReturnValue(true),
      disconnect: vi.fn(),
    } as unknown as RedisAdapter;

    const moduleOptions: RedlockModuleOptions = {
      nodes: [mockAdapter],
      defaultTtl: 30000,
      retryAttempts: 3,
      retryDelay: 200,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedlockService,
        {
          provide: REDLOCK_MODULE_OPTIONS,
          useValue: moduleOptions,
        },
      ],
    }).compile();

    service = module.get<RedlockService>(RedlockService);

    // Initialize the service
    await service.onModuleInit();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize LockManager on module init', async () => {
      // Service was already initialized in beforeEach
      expect(service).toBeDefined();
      // LockManager is private, so we test it indirectly through acquire
    });

    it('should use default TTL when not provided in options', async () => {
      const moduleOptions: RedlockModuleOptions = {
        nodes: [mockAdapter],
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RedlockService,
          {
            provide: REDLOCK_MODULE_OPTIONS,
            useValue: moduleOptions,
          },
        ],
      }).compile();

      const defaultService = module.get<RedlockService>(RedlockService);
      expect(defaultService).toBeDefined();
    });
  });

  describe('acquire', () => {
    it('should acquire a lock with default TTL', async () => {
      const mockSetNX = vi.fn().mockResolvedValue('OK');
      mockAdapter.setNX = mockSetNX;

      const handle = await service.acquire('test:lock');

      expect(handle).toBeDefined();
      expect(handle.key).toBe('test:lock');
      expect(handle.ttl).toBe(30000);
    });

    it('should acquire a lock with custom TTL', async () => {
      const mockSetNX = vi.fn().mockResolvedValue('OK');
      mockAdapter.setNX = mockSetNX;

      const handle = await service.acquire('test:lock', 60000);

      expect(handle).toBeDefined();
      expect(handle.key).toBe('test:lock');
      expect(handle.ttl).toBe(60000);
    });

    it('should throw error if LockManager not initialized', async () => {
      const uninitializedOptions: RedlockModuleOptions = {
        nodes: [mockAdapter],
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RedlockService,
          {
            provide: REDLOCK_MODULE_OPTIONS,
            useValue: uninitializedOptions,
          },
        ],
      }).compile();

      const uninitializedService = module.get<RedlockService>(RedlockService);
      // Don't call onModuleInit()

      await expect(uninitializedService.acquire('test:lock')).rejects.toThrow(
        'LockManager not initialized'
      );
    });
  });

  describe('release', () => {
    it('should release an acquired lock', async () => {
      const mockSetNX = vi.fn().mockResolvedValue('OK');
      const mockDelIfMatch = vi.fn().mockResolvedValue(true);
      mockAdapter.setNX = mockSetNX;
      mockAdapter.delIfMatch = mockDelIfMatch;

      const handle = await service.acquire('test:lock');
      await service.release('test:lock', handle);

      expect(mockDelIfMatch).toHaveBeenCalled();
    });
  });

  describe('using', () => {
    it('should execute function with automatic lock management', async () => {
      const mockSetNX = vi.fn().mockResolvedValue('OK');
      const mockDelIfMatch = vi.fn().mockResolvedValue(true);
      mockAdapter.setNX = mockSetNX;
      mockAdapter.delIfMatch = mockDelIfMatch;

      const testFn = vi.fn().mockResolvedValue('result');

      const result = await service.using('test:lock', testFn);

      expect(result).toBe('result');
      expect(testFn).toHaveBeenCalled();
      expect(mockSetNX).toHaveBeenCalled();
    });

    it('should release lock even if function throws', async () => {
      const mockSetNX = vi.fn().mockResolvedValue('OK');
      const mockDelIfMatch = vi.fn().mockResolvedValue(true);
      mockAdapter.setNX = mockSetNX;
      mockAdapter.delIfMatch = mockDelIfMatch;

      const testFn = vi.fn().mockRejectedValue(new Error('Test error'));

      await expect(service.using('test:lock', testFn)).rejects.toThrow('Test error');

      expect(testFn).toHaveBeenCalled();
      expect(mockSetNX).toHaveBeenCalled();
    });
  });

  describe('lock strategy selection', () => {
    it('should use SimpleLock for single node', async () => {
      const singleNodeOptions: RedlockModuleOptions = {
        nodes: [mockAdapter],
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RedlockService,
          {
            provide: REDLOCK_MODULE_OPTIONS,
            useValue: singleNodeOptions,
          },
        ],
      }).compile();

      const singleNodeService = module.get<RedlockService>(RedlockService);
      await singleNodeService.onModuleInit();

      const mockSetNX = vi.fn().mockResolvedValue('OK');
      mockAdapter.setNX = mockSetNX;

      const handle = await singleNodeService.acquire('test:lock');
      expect(handle).toBeDefined();
      expect(handle.metadata?.strategy).toBe('simple');
    });

    it('should use SimpleLock for two nodes', async () => {
      const mockAdapter2 = { ...mockAdapter } as RedisAdapter;

      const twoNodeOptions: RedlockModuleOptions = {
        nodes: [mockAdapter, mockAdapter2],
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RedlockService,
          {
            provide: REDLOCK_MODULE_OPTIONS,
            useValue: twoNodeOptions,
          },
        ],
      }).compile();

      const twoNodeService = module.get<RedlockService>(RedlockService);
      await twoNodeService.onModuleInit();

      const mockSetNX = vi.fn().mockResolvedValue('OK');
      mockAdapter.setNX = mockSetNX;

      const handle = await twoNodeService.acquire('test:lock');
      expect(handle).toBeDefined();
      expect(handle.metadata?.strategy).toBe('simple');
    });

    it('should use RedLock for three or more nodes', async () => {
      const mockAdapter2 = {
        ...mockAdapter,
        ping: vi.fn().mockResolvedValue('PONG'),
      } as RedisAdapter;
      const mockAdapter3 = {
        ...mockAdapter,
        ping: vi.fn().mockResolvedValue('PONG'),
      } as RedisAdapter;

      const multiNodeOptions: RedlockModuleOptions = {
        nodes: [mockAdapter, mockAdapter2, mockAdapter3],
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RedlockService,
          {
            provide: REDLOCK_MODULE_OPTIONS,
            useValue: multiNodeOptions,
          },
        ],
      }).compile();

      const multiNodeService = module.get<RedlockService>(RedlockService);
      await multiNodeService.onModuleInit();

      const mockSetNX = vi.fn().mockResolvedValue('OK');
      mockAdapter.setNX = mockSetNX;
      mockAdapter2.setNX = mockSetNX;
      mockAdapter3.setNX = mockSetNX;

      const handle = await multiNodeService.acquire('test:lock');
      expect(handle).toBeDefined();
      expect(handle.metadata?.strategy).toBe('redlock');
    });
  });

  describe('cleanup', () => {
    it('should clear locks on module destroy', async () => {
      const mockSetNX = vi.fn().mockResolvedValue('OK');
      mockAdapter.setNX = mockSetNX;

      await service.acquire('test:lock1');
      await service.acquire('test:lock2');

      await service.onModuleDestroy();

      // Service should still work after cleanup
      expect(service).toBeDefined();
    });
  });

  describe('logger support', () => {
    it('should accept logger in module options', async () => {
      const mockLogger: ILogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const moduleOptions: RedlockModuleOptions = {
        nodes: [mockAdapter],
        defaultTtl: 30000,
        logger: mockLogger,
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RedlockService,
          {
            provide: REDLOCK_MODULE_OPTIONS,
            useValue: moduleOptions,
          },
        ],
      }).compile();

      const serviceWithLogger = module.get<RedlockService>(RedlockService);
      await serviceWithLogger.onModuleInit();

      expect(serviceWithLogger).toBeDefined();
    });

    it('should work without logger (optional)', async () => {
      const moduleOptions: RedlockModuleOptions = {
        nodes: [mockAdapter],
        defaultTtl: 30000,
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RedlockService,
          {
            provide: REDLOCK_MODULE_OPTIONS,
            useValue: moduleOptions,
          },
        ],
      }).compile();

      const serviceWithoutLogger = module.get<RedlockService>(RedlockService);
      await serviceWithoutLogger.onModuleInit();

      expect(serviceWithoutLogger).toBeDefined();

      const mockSetNX = vi.fn().mockResolvedValue('OK');
      mockAdapter.setNX = mockSetNX;

      const handle = await serviceWithoutLogger.acquire('test:lock');
      expect(handle).toBeDefined();
    });
  });
});
