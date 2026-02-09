declare module 'rate-limiter-flexible' {
  export interface RateLimiterRes {
    readonly msBeforeNext: number;
    readonly remainingPoints: number;
    readonly consumedPoints: number;
    readonly isFirstInDuration: boolean;
    // According to the errors, `totalPoints` is expected.
    // It's often the `points` configured in the RateLimiter constructor.
    // We'll add it here for now to satisfy the type checker.
    readonly totalPoints: number;
  }

  export class RateLimiterRedis {
    constructor(opts: any); // Using 'any' for options to avoid deep diving into its type
    consume(key: string, pointsToConsume?: number): Promise<RateLimiterRes>;
    getStats(): Promise<{
      points: number;
      msBeforeNext: number;
      consumedPoints: number;
      remainingPoints: number;
      isFirstInDuration: boolean;
    }>;
    // Other methods can be added as needed, but for now, this should cover the errors.
  }

  export class RateLimiterMemory {
    constructor(opts: any);
    consume(key: string, pointsToConsume?: number): Promise<RateLimiterRes>;
    getStats(): Promise<any>;
  }
}
