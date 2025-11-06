import { Test, TestingModule } from '@nestjs/testing';
import { Injectable, Module } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedlockModule } from './redlock.module';
import { RedlockService } from '../service/redlock.service';
import type { RedisAdapter } from 'redlock-universal';
import type { RedlockModuleOptions, RedlockOptionsFactory } from '../interfaces/redlock-module-options.interface';

describe('RedlockModule', () => {
  let mockAdapter: RedisAdapter;

  beforeEach(() => {
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
  });

  describe('forRoot', () => {
    it('should create module with synchronous configuration', async () => {
      const options: RedlockModuleOptions = {
        nodes: [mockAdapter],
        defaultTtl: 30000,
      };

      const module: TestingModule = await Test.createTestingModule({
        imports: [RedlockModule.forRoot(options)],
      }).compile();

      const service = module.get<RedlockService>(RedlockService);
      expect(service).toBeDefined();
    });

    it('should export RedlockService', async () => {
      const options: RedlockModuleOptions = {
        nodes: [mockAdapter],
      };

      const dynamicModule = RedlockModule.forRoot(options);

      expect(dynamicModule.exports).toContain(RedlockService);
    });

    it('should provide REDLOCK_MODULE_OPTIONS', async () => {
      const options: RedlockModuleOptions = {
        nodes: [mockAdapter],
      };

      const dynamicModule = RedlockModule.forRoot(options);

      expect(dynamicModule.providers).toBeDefined();
      expect(dynamicModule.providers?.length).toBeGreaterThan(0);
    });
  });

  describe('forRootAsync', () => {
    it('should create module with useFactory', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          RedlockModule.forRootAsync({
            useFactory: () => ({
              nodes: [mockAdapter],
              defaultTtl: 30000,
            }),
          }),
        ],
      }).compile();

      const service = module.get<RedlockService>(RedlockService);
      expect(service).toBeDefined();
    });

    it('should inject dependencies into factory', async () => {
      @Injectable()
      class ConfigService {
        getRedlockConfig(): RedlockModuleOptions {
          return {
            nodes: [mockAdapter],
            defaultTtl: 60000,
          };
        }
      }

      @Module({
        providers: [ConfigService],
        exports: [ConfigService],
      })
      class ConfigModule {}

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule,
          RedlockModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => config.getRedlockConfig(),
            inject: [ConfigService],
          }),
        ],
      }).compile();

      const service = module.get<RedlockService>(RedlockService);
      expect(service).toBeDefined();
    });

    it('should create module with useClass', async () => {
      class RedlockConfigService implements RedlockOptionsFactory {
        createRedlockOptions(): RedlockModuleOptions {
          return {
            nodes: [mockAdapter],
            defaultTtl: 30000,
          };
        }
      }

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          RedlockModule.forRootAsync({
            useClass: RedlockConfigService,
          }),
        ],
      }).compile();

      const service = module.get<RedlockService>(RedlockService);
      expect(service).toBeDefined();
    });

    it('should create module with useExisting', async () => {
      class RedlockConfigService implements RedlockOptionsFactory {
        createRedlockOptions(): RedlockModuleOptions {
          return {
            nodes: [mockAdapter],
            defaultTtl: 30000,
          };
        }
      }

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          RedlockModule.forRootAsync({
            useExisting: RedlockConfigService,
          }),
        ],
        providers: [RedlockConfigService],
      }).compile();

      const service = module.get<RedlockService>(RedlockService);
      expect(service).toBeDefined();
    });

    it('should throw error if no configuration method provided', () => {
      expect(() => {
        RedlockModule.forRootAsync({});
      }).toThrow('Invalid RedlockModuleAsyncOptions');
    });

    it('should import additional modules', async () => {
      class ConfigModule {}

      const dynamicModule = RedlockModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: () => ({
          nodes: [mockAdapter],
        }),
      });

      expect(dynamicModule.imports).toContain(ConfigModule);
    });
  });

  describe('module structure', () => {
    it('should be a global module', () => {
      const options: RedlockModuleOptions = {
        nodes: [mockAdapter],
      };

      const dynamicModule = RedlockModule.forRoot(options);

      // The @Global() decorator makes it global
      expect(dynamicModule.module).toBe(RedlockModule);
    });

    it('should have proper module definition', () => {
      const options: RedlockModuleOptions = {
        nodes: [mockAdapter],
      };

      const dynamicModule = RedlockModule.forRoot(options);

      expect(dynamicModule).toHaveProperty('module');
      expect(dynamicModule).toHaveProperty('providers');
      expect(dynamicModule).toHaveProperty('exports');
    });
  });
});
