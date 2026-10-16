import 'server-only';

/**
 * Sign-in methods the API offers besides email and password, for the login
 * and signup pages. Cached like the other public reads; Google is hidden when
 * the API can't be reached (e.g. during `next build`), never shown broken.
 */

const API = (process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000').replace(/\/$/, '');

export interface AuthProviders {
  google: boolean;
}

export async function getAuthProviders(): Promise<AuthProviders> {
  try {
    const res = await fetch(`${API}/api/auth/providers`, {
      next: { tags: ['auth-providers'], revalidate: 300 },
    });
    if (!res.ok) return { google: false };
    const data = (await res.json()) as Partial<AuthProviders>;
    return { google: data.google === true };
  } catch {
    return { google: false };
  }
}
