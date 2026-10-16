/** Pure time helpers for the 10-minute acceptance window. Kept free of React so they stay unit-testable. */

/** Default acceptance window: a 'new' order is auto-cancelled by the backend after 10 minutes. */
export const ACCEPT_WINDOW_MS = 10 * 60 * 1000;

/** Threshold under which the countdown is shown in red. */
export const URGENT_MS = 2 * 60 * 1000;

/** Milliseconds left in the acceptance window (never negative; 0 for an invalid date). */
export function remainingMs(createdAtIso: string, nowMs: number, windowMs: number = ACCEPT_WINDOW_MS): number {
  const created = new Date(createdAtIso).getTime();
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, created + windowMs - nowMs);
}

/** 'm:ss' - e.g. 600000 -> '10:00', 61000 -> '1:01', 0 -> '0:00'. Rounds up so a fresh order reads 10:00. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
