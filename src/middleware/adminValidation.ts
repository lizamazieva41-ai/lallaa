import { z } from 'zod';

// BIN lookup validation schema
export const adminBinLookupSchema = z.object({
  bin: z.string()
    .regex(/^\d{6,8}$/, 'BIN must be 6-8 digits')
    .transform(val => val.trim())
});

// BIN source query validation schema
export const adminBinSourceSchema = z.object({
  source: z.string()
    .min(1, 'Source is required')
    .max(100, 'Source name too long')
    .transform(val => val.trim())
});

// ETL history query validation schema
export const adminETLHistorySchema = z.object({
  limit: z.string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : 50)
    .pipe(z.number().int().min(1).max(100))
});

// Validation middleware factory
export const validateAdminRequest = (schema: z.ZodSchema) => {
  return async (req: any, res: any, next: any) => {
    try {
      const validated = await schema.parseAsync(req.params || req.query);
      Object.assign(req.params || req.query, validated);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code
            }))
          }
        });
      }
      next(error);
    }
  };
};