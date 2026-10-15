import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@pv/shared';
import { prisma } from '../lib/prisma';
import { verifyAccessToken } from '../lib/jwt';
import { forbidden, unauthorized } from '../lib/http-error';

export const ACCESS_COOKIE = 'pv_at';
export const REFRESH_COOKIE = 'pv_rt';

function readToken(req: Request): string | null {
  const cookie = req.cookies?.[ACCESS_COOKIE];
  if (typeof cookie === 'string' && cookie) return cookie;
  const header = req.header('authorization');
  if (header?.startsWith('Bearer ') && !header.startsWith('Bearer pv_')) return header.slice(7);
  return null;
}

async function loadUser(req: Request): Promise<boolean> {
  const token = readToken(req);
  if (!token) return false;
  const claims = verifyAccessToken(token);
  if (!claims) return false;
  // Re-read the user so suspensions and role changes apply immediately rather
  // than when the 15-minute access token expires.
  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, email: true, name: true, role: true, workspaceId: true, suspended: true },
  });
  if (!user || user.suspended) return false;
  req.user = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    workspaceId: user.workspaceId,
  };
  return true;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  if (!(await loadUser(req))) throw unauthorized();
  next();
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  await loadUser(req);
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
}

export const requireStaff = requireRole('ADMIN', 'SUPER_ADMIN');
export const requireSuperAdmin = requireRole('SUPER_ADMIN');
