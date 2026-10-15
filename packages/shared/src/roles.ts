/**
 * Who can do what.
 *
 * A *visitor* is anyone without a session: they see the public website and
 * can sign up. Everything below is an authenticated role.
 *
 *  SUBSCRIBER   owns a workspace. Uses the dashboard; can only connect numbers
 *               and create agents once a subscription is active, and only up
 *               to what their plan allows.
 *  ADMIN        staff. Sees every workspace, can act inside one to help a
 *               customer set up, manages subscriptions, website pages, blog,
 *               FAQs, SEO and support.
 *  SUPER_ADMIN  everything an admin can do, plus revenue / churn insights,
 *               plan pricing and staff management.
 */
export const ROLES = ['SUBSCRIBER', 'ADMIN', 'SUPER_ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_ROLES: readonly Role[] = ['ADMIN', 'SUPER_ADMIN'];

export function isStaff(role: Role | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function isSuperAdmin(role: Role | null | undefined): boolean {
  return role === 'SUPER_ADMIN';
}

/** Where a freshly signed-in user should land. */
export function homePathForRole(role: Role): string {
  return isStaff(role) ? '/admin' : '/dashboard';
}
