import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/http-error';
import { logger } from '../lib/logger';

export function notFoundHandler(req: Request, res: Response) {
  res
    .status(404)
    .json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` } });
}

// Express recognises error handlers by arity, so `next` must stay in the signature.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_error',
        message: err.issues[0]?.message ?? 'Invalid input',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: { code: 'conflict', message: 'That already exists' } });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { code: 'not_found', message: 'Not found' } });
      return;
    }
    if (err.code === 'P2003') {
      res.status(409).json({
        error: {
          code: 'conflict',
          message: 'It is still in use elsewhere. Remove those links first.',
        },
      });
      return;
    }
  }

  const body = err as { type?: string; status?: number };
  if (body?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'bad_json', message: 'Malformed JSON body' } });
    return;
  }
  if (body?.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'too_large', message: 'Request body too large' } });
    return;
  }

  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  res.status(500).json({ error: { code: 'internal', message: 'Something went wrong' } });
}
