import type { NextFunction, Request, Response } from 'express';
import { isStaff } from '@pv/shared';
import { prisma } from '../lib/prisma';
import { badRequest, forbidden, notFound, unauthorized } from '../lib/http-error';

export const WORKSPACE_HEADER = 'x-workspace-id';

/**
 * Decides which workspace a dashboard request acts on.
 *
 * A subscriber always acts on their own workspace; any header they send is
 * ignored. A staff member names a workspace with the X-Workspace-Id header —
 * that is how an admin opens a customer's dashboard to help them set up —
 * and every write they make there is audited with `actingAsStaff`.
 */
export async function resolveWorkspace(req: Request, _res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) throw unauthorized();

  if (isStaff(user.role)) {
    const requested = req.header(WORKSPACE_HEADER);
    if (!requested) throw badRequest('Choose a customer workspace first');
    const ws = await prisma.workspace.findUnique({ where: { id: requested }, select: { id: true } });
    if (!ws) throw notFound('Workspace');
    req.workspaceId = ws.id;
    req.actingAsStaff = true;
    return next();
  }

  if (!user.workspaceId) throw forbidden('No workspace on this account');
  const ws = await prisma.workspace.findUnique({
    where: { id: user.workspaceId },
    select: { id: true, suspended: true },
  });
  if (!ws) throw notFound('Workspace');
  if (ws.suspended) throw forbidden('This workspace is suspended. Please contact support.');
  req.workspaceId = ws.id;
  req.actingAsStaff = false;
  next();
}

/** Narrowing helper for handlers mounted behind resolveWorkspace. */
export function wsId(req: Request): string {
  if (!req.workspaceId) throw badRequest('Workspace not resolved');
  return req.workspaceId;
}
