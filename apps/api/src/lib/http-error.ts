export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, message, 'bad_request', details);
export const unauthorized = (message = 'Sign in to continue') =>
  new HttpError(401, message, 'unauthorized');
export const forbidden = (message = 'You do not have access to this') =>
  new HttpError(403, message, 'forbidden');
export const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`, 'not_found');
export const conflict = (message: string) => new HttpError(409, message, 'conflict');

/** The workspace needs an active subscription for this. */
export const subscriptionRequired = (message = 'An active subscription is required') =>
  new HttpError(402, message, 'subscription_required');

/** The workspace's plan does not include this, or a limit is reached. */
export const planLimit = (message: string, details?: unknown) =>
  new HttpError(403, message, 'plan_limit', details);
