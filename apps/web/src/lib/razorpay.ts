/**
 * Razorpay Standard Checkout, loaded on demand so the script (and its
 * third-party requests) never touches pages that don't sell anything.
 */

const SRC = 'https://checkout.razorpay.com/v1/checkout.js';

interface RazorpayOptions {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string; backdrop_color?: string };
  modal?: { ondismiss?: () => void; confirm_close?: boolean };
  handler?: (response: {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
  }) => void;
}
interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', cb: (r: { error: { description?: string } }) => void): void;
}
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;

export function loadRazorpay(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Browser only'));
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error('Could not load Razorpay. Check your connection or ad blocker and retry.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export interface RazorpayCheckout {
  keyId: string;
  subscriptionId: string;
  name: string;
  email: string;
  description: string;
}

/** Opens the Razorpay popup. `onPaid` fires after a successful payment; `onClosed` if dismissed first. */
export async function openRazorpay(
  c: RazorpayCheckout,
  cb: { onPaid: () => void; onClosed: () => void; onFailed: (message: string) => void },
) {
  await loadRazorpay();
  if (!window.Razorpay) throw new Error('Razorpay did not load');
  let paid = false;
  const rzp = new window.Razorpay({
    key: c.keyId,
    subscription_id: c.subscriptionId,
    name: 'Purple Voice',
    description: c.description,
    prefill: { name: c.name, email: c.email },
    theme: { color: '#6236F0', backdrop_color: 'rgba(7,6,12,0.72)' },
    handler: () => {
      paid = true;
      cb.onPaid();
    },
    modal: {
      ondismiss: () => {
        if (!paid) cb.onClosed();
      },
    },
  });
  rzp.on('payment.failed', (r) => cb.onFailed(r.error.description ?? 'The payment failed'));
  rzp.open();
}
