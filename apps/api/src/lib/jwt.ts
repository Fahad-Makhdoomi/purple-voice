import jwt from 'jsonwebtoken';
import type { Role } from '@pv/shared';
import { env } from '../config/env';

export interface AccessClaims {
  sub: string;
  role: Role;
  wid: string | null;
}

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    expiresIn: `${env.ACCESS_TOKEN_TTL_MIN}m`,
    issuer: 'purple-voice',
    audience: 'purple-voice-web',
  });
}

export function verifyAccessToken(token: string): AccessClaims | null {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'purple-voice',
      audience: 'purple-voice-web',
    }) as jwt.JwtPayload & AccessClaims;
    return { sub: payload.sub, role: payload.role, wid: payload.wid ?? null };
  } catch {
    return null;
  }
}
