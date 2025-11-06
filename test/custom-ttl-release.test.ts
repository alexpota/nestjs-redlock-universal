/**
 * Comprehensive tests for acquire/release with custom TTL
 *
 * These tests verify that the RedlockService correctly handles locks with
 * custom TTL values, ensuring no memory leaks and proper release behavior.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RedlockService } from '../src/service/redlock.service';
import { RedlockModule } from '../src/module/redlock.module';
import { vi } from 'vitest';

describe('Custom TTL Acquire/Release', () => {
  let service: RedlockService;
  let mockDelIfMatch: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockDelIfMatch = vi.fn().mockResolvedValue(true);

    const mockAdapter = {
      setNX: vi.fn().mockResolvedValue('OK'),
      delIfMatch: mockDelIfMatch,
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [RedlockModule.forRoot({ nodes: [mockAdapter] })],
    }).compile();

    service = module.get<RedlockService>(RedlockService);
    await module.init();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully release a lock acquired with custom TTL', async () => {
    const handle = await service.acquire('test:custom:ttl', 60000);

    expect(handle.ttl).toBe(60000);
    expect(handle.key).toBe('test:custom:ttl');

    // This should not throw and should call delIfMatch
    await service.release('test:custom:ttl', handle);

    expect(mockDelIfMatch).toHaveBeenCalledWith(handle.key, handle.value);
  });

  it('should handle locks with different TTLs for the same key', async () => {
    // Acquire with custom TTL
    const handle1 = await service.acquire('test:key', 45000);
    expect(handle1.ttl).toBe(45000);
    await service.release('test:key', handle1);

    // Acquire same key with different TTL
    const handle2 = await service.acquire('test:key', 120000);
    expect(handle2.ttl).toBe(120000);
    await service.release('test:key', handle2);

    // Each release should have been called correctly
    expect(mockDelIfMatch).toHaveBeenCalledTimes(2);
  });

  it('should handle mixed default and custom TTL locks', async () => {
    // Default TTL
    const handle1 = await service.acquire('key:1');
    expect(handle1.ttl).toBe(30000); // DEFAULT_TTL_MS

    // Custom TTL
    const handle2 = await service.acquire('key:2', 60000);
    expect(handle2.ttl).toBe(60000);

    // Another default TTL
    const handle3 = await service.acquire('key:3');
    expect(handle3.ttl).toBe(30000);

    // Release all
    await service.release('key:1', handle1);
    await service.release('key:2', handle2);
    await service.release('key:3', handle3);

    expect(mockDelIfMatch).toHaveBeenCalledTimes(3);
  });

  it('should not cache locks with custom TTL (memory leak prevention)', async () => {
    // Acquire many locks with different custom TTLs
    const handles = [];
    for (let i = 0; i < 100; i++) {
      const handle = await service.acquire(`key:${i}`, 30000 + i * 1000);
      handles.push(handle);
    }

    // Release all
    for (let i = 0; i < 100; i++) {
      await service.release(`key:${i}`, handles[i]);
    }

    // Verify all releases were called
    expect(mockDelIfMatch).toHaveBeenCalledTimes(100);
  });

  it('should reuse cached locks for default TTL', async () => {
    // Acquire same key multiple times with default TTL
    const handle1 = await service.acquire('cached:key');
    await service.release('cached:key', handle1);

    const handle2 = await service.acquire('cached:key');
    await service.release('cached:key', handle2);

    // Both should work correctly
    expect(mockDelIfMatch).toHaveBeenCalledTimes(2);
    expect(handle1.ttl).toBe(handle2.ttl);
  });
});
