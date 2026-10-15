import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.apiKey',
      '*.authToken',
      '*.password',
      '*.secret',
    ],
    censor: '[redacted]',
  },
  transport:
    env.isProd || env.isTest
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
});
