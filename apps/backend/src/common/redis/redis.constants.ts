/**
 * DI token for the shared ioredis client. Lives in its own file so services
 * (CacheService, IdempotencyService) can import it without importing the
 * module that also imports them — a circular import leaves the token
 * `undefined` at decoration time and Nest then fails with "can't resolve
 * dependencies of X (?)".
 */
export const REDIS_CLIENT = 'REDIS_CLIENT';
