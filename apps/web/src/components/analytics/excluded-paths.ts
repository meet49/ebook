/**
 * Pages that third-party trackers (Google Analytics, Meta Pixel) never load on: admin screens,
 * and pages whose URL carries a one-time secret (email sign-in, verification and password-reset
 * links). Those secrets must not be sent to a third party, and since the links open as a fresh
 * page load, the trackers are simply never present there.
 */
const EXCLUDED = ["/admin", "/auth/magic", "/verify-email", "/reset-password"];

export const isTrackingExcluded = (path: string) => EXCLUDED.some((p) => path === p || path.startsWith(`${p}/`));
