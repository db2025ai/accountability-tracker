// Browsers' push services. Subscriptions anywhere else are refused (and never sent to), so a key
// that leaked once can't keep a private endpoint on the reminder list after the key is rotated.
const PUSH_HOSTS = /^(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)$/;

export function isPushService(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && PUSH_HOSTS.test(url.hostname);
  } catch {
    return false;
  }
}
