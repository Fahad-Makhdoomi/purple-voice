import { TwilioAdapter } from './twilio';
import type { SignalWireCredentials } from './types';

/**
 * SignalWire through its Compatibility (LaML) API: Twilio's REST API, call
 * statuses and markup at https://{space}.signalwire.com/api/laml/2010-04-01,
 * authenticated with the Project ID and an API token. <Connect><Stream>
 * speaks the Twilio Media Streams protocol, so calls use TwilioTransport.
 */
export class SignalWireAdapter extends TwilioAdapter {
  override readonly provider = 'SIGNALWIRE' as const;
  protected override readonly vendor = 'SignalWire';

  constructor(creds: SignalWireCredentials) {
    super(
      { accountSid: creds.projectId, authToken: creds.apiToken },
      `https://${creds.spaceUrl}/api/laml/2010-04-01`,
    );
  }
}
