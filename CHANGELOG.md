# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-05

### Added

- Initial release of `nestjs-redlock-universal`
- **RedlockModule**: NestJS dynamic module with `forRoot()` and `forRootAsync()` configuration
- **RedlockService**: Injectable service for programmatic lock management
  - `acquire()`: Manual lock acquisition
  - `release()`: Manual lock release
  - `using()`: Automatic lock management with extension support
- **@Redlock Decorator**: Zero-boilerplate method-level distributed locking
  - Static lock keys
  - Dynamic lock keys from method arguments
  - Custom TTL and retry configuration
- **Universal Redis Client Support**: Works with both node-redis and ioredis via `redlock-universal` adapters
- **Automatic Strategy Selection**:
  - SimpleLock for 1-2 Redis nodes
  - RedLock (distributed) for 3+ Redis nodes
- **TypeScript Support**: Full type safety with strict mode
- **Comprehensive Tests**: 35 unit tests with 79% coverage

### Documentation

- Comprehensive README with quick start guide
- API reference with examples
- Configuration examples (sync and async)
- Best practices for lock key naming
- Common use cases and patterns

[0.1.0]: https://github.com/alexpota/nestjs-redlock-universal/releases/tag/v0.1.0
