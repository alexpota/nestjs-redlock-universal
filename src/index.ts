// NestJS Integration
export { Redlock } from './decorators/redlock.decorator';
export { RedlockModule } from './module/redlock.module';
export { RedlockService } from './service/redlock.service';

// Module Configuration
export type {
  RedlockModuleOptions,
  RedlockOptionsFactory,
  RedlockModuleAsyncOptions,
} from './interfaces/redlock-module-options.interface';

export type { RedlockDecoratorOptions } from './interfaces/redlock-decorator-options.interface';

// Constants
export {
  REDLOCK_MODULE_OPTIONS,
  REDLOCK_SERVICE,
  DEFAULT_TTL_MS,
  DEFAULT_RETRY_ATTEMPTS,
  DEFAULT_RETRY_DELAY_MS,
  MIN_NODES_FOR_REDLOCK,
} from './constants';
