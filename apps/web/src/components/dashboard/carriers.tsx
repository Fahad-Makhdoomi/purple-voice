'use client';

import { Copy } from 'lucide-react';
import type { TelephonyProvider } from '@pv/shared';
import { toast } from '@/components/ui';

export type CarrierStatus = 'live' | 'manual' | 'soon';

export interface CarrierField {
  name: string;
  label: string;
  type?: 'text' | 'password' | 'textarea' | 'select';
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  optional?: boolean;
}

export interface CarrierInfo {
  provider: TelephonyProvider;
  blurb: string;
  status: CarrierStatus;
  fields: CarrierField[];
  /** Where to find each credential. */
  help: string;
  /** What has to be done in the carrier's console after connecting. */
  setup?: string;
}

/** Carriers in the order the picker shows them. */
export const CARRIERS: CarrierInfo[] = [
  {
    provider: 'TWILIO',
    blurb: 'Global programmable voice in 100+ countries.',
    status: 'live',
    fields: [
      { name: 'accountSid', label: 'Account SID', placeholder: 'AC…' },
      { name: 'authToken', label: 'Auth token', type: 'password' },
    ],
    help: 'Both are under Account Info on the Twilio Console home page.',
  },
  {
    provider: 'PLIVO',
    blurb: 'Voice API with strong India and US coverage.',
    status: 'live',
    fields: [
      { name: 'authId', label: 'Auth ID' },
      { name: 'authToken', label: 'Auth token', type: 'password' },
    ],
    help: 'Both are on the Plivo console overview page.',
  },
  {
    provider: 'EXOTEL',
    blurb: 'India’s cloud telephony leader, via AgentStream.',
    status: 'manual',
    fields: [
      { name: 'accountSid', label: 'Account SID' },
      { name: 'apiKey', label: 'API key' },
      { name: 'apiToken', label: 'API token', type: 'password' },
      {
        name: 'subdomain',
        label: 'Cluster',
        type: 'select',
        options: [
          { value: 'api.in.exotel.com', label: 'Mumbai (api.in.exotel.com)' },
          { value: 'api.exotel.com', label: 'Singapore (api.exotel.com)' },
        ],
      },
    ],
    help: 'All four are under Developer Settings → API Settings in your Exotel dashboard. AgentStream (Voicebot) must be enabled on the account — ask Exotel support if it isn’t.',
    setup:
      'Outbound calls work right away. For incoming calls, add a Voicebot applet to each ExoPhone’s App Bazaar flow and paste the URL shown next to the number.',
  },
  {
    provider: 'SIGNALWIRE',
    blurb: 'Twilio-compatible API at lower per-minute rates.',
    status: 'live',
    fields: [
      { name: 'spaceUrl', label: 'Space URL', placeholder: 'example.signalwire.com' },
      { name: 'projectId', label: 'Project ID' },
      { name: 'apiToken', label: 'API token', type: 'password', placeholder: 'PT…' },
    ],
    help: 'All three are on your Space’s API page. Give the token the Voice and Numbers scopes.',
  },
  {
    provider: 'TELNYX',
    blurb: 'Global carrier running its own private network.',
    status: 'live',
    fields: [
      { name: 'apiKey', label: 'API key', type: 'password', placeholder: 'KEY…' },
      { name: 'applicationId', label: 'TeXML Application ID' },
    ],
    help: 'API key: Mission Control → Keys & Credentials. Create a TeXML Application under Voice → Programmable Voice with an Outbound Voice Profile and paste its ID; Purple Voice sets its URLs.',
  },
  {
    provider: 'VONAGE',
    blurb: 'Vonage Voice API (formerly Nexmo), worldwide.',
    status: 'live',
    fields: [
      { name: 'apiKey', label: 'API key' },
      { name: 'apiSecret', label: 'API secret', type: 'password' },
      { name: 'applicationId', label: 'Application ID' },
      {
        name: 'privateKey',
        label: 'Private key',
        type: 'textarea',
        placeholder: '-----BEGIN PRIVATE KEY-----',
      },
    ],
    help: 'API key and secret are on the dashboard home. Create an application with Voice turned on, generate a key pair and paste the downloaded private.key. Purple Voice sets its answer and event URLs.',
  },
  {
    provider: 'BANDWIDTH',
    blurb: 'US carrier-grade network that owns its numbers.',
    status: 'manual',
    fields: [
      { name: 'accountId', label: 'Account ID' },
      { name: 'clientId', label: 'OAuth client ID' },
      { name: 'clientSecret', label: 'OAuth client secret', type: 'password' },
      { name: 'applicationId', label: 'Voice Application ID' },
    ],
    help: 'Account ID is in the Bandwidth App’s top bar. Create OAuth client credentials with Voice access under Account → API Credentials. The Voice Application ID is under Applications.',
    setup:
      'Outbound calls work right away. For incoming calls, paste the two URLs shown on the carrier card into the Voice Application and add your numbers to its location. Type numbers in by hand when adding them.',
  },
  {
    provider: 'SUPERPHONE',
    blurb: 'Saved now; AI calling arrives with SuperPhone’s API.',
    status: 'soon',
    fields: [
      { name: 'apiKey', label: 'API key' },
      { name: 'sipDomain', label: 'SIP domain', optional: true },
    ],
    help: 'Saved for when SuperPhone AI calling is available.',
  },
];

export const carrierInfo = (p: TelephonyProvider) =>
  CARRIERS.find((c) => c.provider === p) ?? CARRIERS[0];

export function CarrierBadge({ status }: { status: CarrierStatus }) {
  if (status === 'live') return <span className="badge badge-success">Live</span>;
  if (status === 'manual') return <span className="badge badge-warning">Manual inbound setup</span>;
  return <span className="badge badge-neutral">Coming soon</span>;
}

/** URLs to paste in the carrier's console, each with a copy button. */
export function InboundSetup({
  items,
  intro,
}: {
  items: Array<{ label: string; url: string }>;
  intro?: string;
}) {
  return (
    <div className="mt-2 space-y-2 rounded-sm border border-line bg-canvas p-3 text-xs">
      {intro && <p className="text-muted">{intro}</p>}
      {items.map((item) => (
        <div key={item.label}>
          <p className="font-semibold text-ink-soft">{item.label}</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono" title={item.url}>
              {item.url}
            </code>
            <button
              type="button"
              className="btn btn-ghost btn-icon h-7 w-7 shrink-0"
              aria-label={`Copy ${item.label}`}
              onClick={() =>
                void navigator.clipboard
                  .writeText(item.url)
                  .then(() => toast('Copied'))
                  .catch(() => toast('Could not copy', 'error'))
              }
            >
              <Copy size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
