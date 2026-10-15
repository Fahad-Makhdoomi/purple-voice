import type { TelephonyAccount, TelephonyProvider } from '@prisma/client';
import { decryptJson } from '../lib/crypto';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/http-error';
import { TwilioAdapter } from './twilio';
import { PlivoAdapter } from './plivo';
import { SuperPhoneAdapter } from './superphone';
import type {
  PlivoCredentials,
  SuperPhoneCredentials,
  TelephonyAdapter,
  TelephonyCredentials,
  TwilioCredentials,
} from './types';

export function createAdapter(provider: TelephonyProvider, creds: TelephonyCredentials): TelephonyAdapter {
  switch (provider) {
    case 'TWILIO':
      return new TwilioAdapter(creds as TwilioCredentials);
    case 'PLIVO':
      return new PlivoAdapter(creds as PlivoCredentials);
    case 'SUPERPHONE':
      return new SuperPhoneAdapter(creds as SuperPhoneCredentials);
  }
}

export function adapterForAccount(account: Pick<TelephonyAccount, 'provider' | 'credentialsEnc'>) {
  return createAdapter(account.provider, decryptJson<TelephonyCredentials>(account.credentialsEnc));
}

/** Adapter for the account behind a connected phone number. */
export async function adapterForNumber(phoneNumberId: string) {
  const number = await prisma.phoneNumber.findUnique({
    where: { id: phoneNumberId },
    include: { telephonyAccount: true },
  });
  if (!number) throw notFound('Phone number');
  return { number, adapter: adapterForAccount(number.telephonyAccount) };
}

export * from './types';
