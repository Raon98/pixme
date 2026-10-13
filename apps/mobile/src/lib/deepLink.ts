/**
 * Deep links arrive from the server (notification payloads), so they are
 * untrusted input to the router.
 *
 * <p>A server-side typo used to be able to strand the user: hearts linked to
 * `/today/{id}`, a route that has never existed, so the most common
 * notification in the app dead-ended on expo-router's "Unmatched Route"
 * screen. Validating here means the worst case is "the notification just
 * opens the app", never a broken screen the user can't get out of.
 */
const ALLOWED_PREFIXES = [
  '/daily-status/',
  '/chat/',
  '/user/',
  '/connection-success',
  '/create',
  '/store',
  '/notifications',
  '/(tabs)',
] as const;

export function isSafeDeepLink(link: string | undefined | null): link is string {
  if (!link) return false;
  // Only in-app absolute paths — never an external scheme or a protocol-
  // relative URL that would leave the app.
  if (!link.startsWith('/') || link.startsWith('//')) return false;
  return ALLOWED_PREFIXES.some((prefix) => link.startsWith(prefix));
}
