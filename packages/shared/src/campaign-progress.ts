import type { CampaignStatus, ContactStatus } from './enums';

/**
 * How far a campaign has got, for its progress bar and the campaign list.
 *
 * Every call moves the bar: a contact counts as done once it has a final
 * result (reached, do-not-call, or out of retries), and a contact waiting for
 * a retry counts for the calls already made out of the calls it may get. So
 * after one pass through a list where some people did not pick up, the bar
 * shows the list as gone through with the retries still to come, and it
 * reaches 100% exactly when the campaign completes. A finished campaign is
 * always 100%; `incomplete` says some numbers were never reached, which the
 * dashboard shows in a different colour, with those numbers in Analytics.
 */
export interface CampaignProgress {
  total: number;
  /** Spoke to a person. */
  reached: number;
  /** Asked not to be called again. */
  doNotCall: number;
  /** Out of retries without reaching anyone (no answer, voicemail, failed). */
  unreached: number;
  /** Called at least once, waiting for another try. */
  waitingRetry: number;
  /** Not called yet. */
  notCalled: number;
  /** On a call right now. */
  calling: number;
  /** Called at least once. */
  dialled: number;
  /** 0–100. */
  percent: number;
  /** Every number has had its first call. */
  firstPassDone: boolean;
  /** The retry the waiting numbers are on (1 = first retry), or 0 when none wait. */
  retryRound: number;
  /** Retries each number may get. */
  maxRetries: number;
  /** The campaign has ended. */
  finished: boolean;
  /** It ended with numbers never reached or never called. */
  incomplete: boolean;
}

/** Contacts of one campaign grouped by status and attempts made. */
export interface ContactProgressRow {
  status: ContactStatus;
  attempts: number;
  count: number;
}

const FINAL: ContactStatus[] = ['COMPLETED', 'DO_NOT_CALL', 'NO_ANSWER', 'FAILED'];

export function campaignProgress(
  rows: ContactProgressRow[],
  maxAttempts: number,
  status: CampaignStatus,
): CampaignProgress {
  const max = Math.max(1, maxAttempts);
  const finished = status === 'COMPLETED' || status === 'CANCELED';
  const p: CampaignProgress = {
    total: 0,
    reached: 0,
    doNotCall: 0,
    unreached: 0,
    waitingRetry: 0,
    notCalled: 0,
    calling: 0,
    dialled: 0,
    percent: 0,
    firstPassDone: false,
    retryRound: 0,
    maxRetries: max - 1,
    finished,
    incomplete: false,
  };
  let done = 0;
  let lowestWaiting = Infinity;
  for (const r of rows) {
    p.total += r.count;
    if (r.attempts > 0) p.dialled += r.count;
    if (FINAL.includes(r.status)) {
      done += r.count;
      if (r.status === 'COMPLETED') p.reached += r.count;
      else if (r.status === 'DO_NOT_CALL') p.doNotCall += r.count;
      else p.unreached += r.count;
    } else if (r.status === 'CALLING') {
      p.calling += r.count;
      // The call under way is not finished yet: only the earlier ones count.
      done += r.count * Math.min(1, Math.max(0, r.attempts - 1) / max);
    } else if (r.attempts > 0) {
      p.waitingRetry += r.count;
      lowestWaiting = Math.min(lowestWaiting, r.attempts);
      done += r.count * Math.min(1, r.attempts / max);
    } else {
      p.notCalled += r.count;
    }
  }
  p.firstPassDone = p.total > 0 && p.notCalled === 0 && p.calling === 0;
  p.retryRound = Number.isFinite(lowestWaiting) ? Math.min(lowestWaiting, p.maxRetries) : 0;
  if (finished) {
    p.percent = 100;
    p.incomplete = p.unreached + p.waitingRetry + p.notCalled + p.calling > 0;
  } else if (p.total) {
    const raw = (done / p.total) * 100;
    // Never show 100% while something is still to be dialled.
    p.percent = done >= p.total ? 100 : Math.min(99, Math.floor(raw));
  }
  return p;
}
