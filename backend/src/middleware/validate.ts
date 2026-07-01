import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny } from 'zod';

/** Validates req.body against a zod schema and replaces it with parsed data. */
export const validateBody =
  (schema: ZodTypeAny) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data;
    next();
  };

export const validateQuery =
  (schema: ZodTypeAny) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return next(result.error);
    (req as any).validatedQuery = result.data;
    next();
  };
