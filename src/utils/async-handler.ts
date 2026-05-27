import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './http-error.js';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void> | void;

export function asyncHandler(fn: AsyncHandler): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
