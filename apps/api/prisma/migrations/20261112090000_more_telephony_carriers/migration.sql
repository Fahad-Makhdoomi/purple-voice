-- More programmable-voice carriers a workspace can connect.
ALTER TYPE "TelephonyProvider" ADD VALUE IF NOT EXISTS 'SIGNALWIRE';
ALTER TYPE "TelephonyProvider" ADD VALUE IF NOT EXISTS 'TELNYX';
ALTER TYPE "TelephonyProvider" ADD VALUE IF NOT EXISTS 'EXOTEL';
ALTER TYPE "TelephonyProvider" ADD VALUE IF NOT EXISTS 'VONAGE';
ALTER TYPE "TelephonyProvider" ADD VALUE IF NOT EXISTS 'BANDWIDTH';
