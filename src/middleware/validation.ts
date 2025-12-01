import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  res.status(422).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: errors.array(),
    },
  });
};
