import type { Role, Entitlements } from '@pv/shared';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  workspaceId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** The workspace this request acts on (own workspace, or one a staff member selected). */
      workspaceId?: string;
      /** True when a staff member is acting inside a customer's workspace. */
      actingAsStaff?: boolean;
      /** Cached per request by middleware/entitlements. */
      entitlements?: Entitlements;
      /** Set when the request authenticated with a developer API key. */
      apiKeyId?: string;
      /** Raw body, kept for Stripe signature verification. */
      rawBody?: Buffer;
    }
  }
}

export {};
