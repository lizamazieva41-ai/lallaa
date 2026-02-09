import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Middleware to check if a feature is enabled
 */
export const requireFeature = (feature: keyof typeof config.features) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!config.features[feature]) {
      logger.warn('Attempted access to disabled feature', {
        feature,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
      });

      res.status(404).json({
        success: false,
        error: {
          code: 'FEATURE_DISABLED',
          message: 'This feature is currently unavailable',
        },
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to restrict card generation to specific environments
 */
export const requireEnvironment = (allowedEnvs: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const currentEnv = config.app.env;
    
    if (!allowedEnvs.includes(currentEnv)) {
      logger.warn('Attempted access to environment-restricted feature', {
        currentEnv,
        allowedEnvs,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'ENVIRONMENT_RESTRICTED',
          message: 'This feature is not available in the current environment',
        },
      });
      return;
    }

    next();
  };
};

/**
 * Combined middleware for card generation security
 */
export const secureCardGeneration = [
  requireFeature('cardGeneration'),
  requireEnvironment(['development', 'staging', 'test']), // Not available in production
];

/**
 * Combined middleware for test cards access
 */
export const secureTestCards = [
  requireFeature('testCardsAccess'),
];
