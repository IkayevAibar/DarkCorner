/**
 * The ugolok.world single sign-on token.
 *
 * ============================ COPY NOTICE ============================
 * This file exists twice, byte for byte identical:
 *
 *   Aetherbound  apps/api/src/sso.ts
 *   Hardcore MC  apps/api/src/lib/sso.ts
 *
 * They are separate repositories with separate installs, so there is no
 * package to share -- and a shared package would have to be published
 * somewhere for two independent Docker builds to install it, which is a lot
 * of machinery for a hundred lines of HMAC.
 *
 * Change the token format in one and you must change it in the other in the
 * same breath, or one site starts rejecting the other's sessions and the
 * symptom is "logging in works, but the other subdomain says I'm signed out".
 * `diff` the two files if you suspect that has happened.
 *
 * It deliberately imports nothing but node:crypto so that copying it is all
 * there is to it.
 * ====================================================================
 *
 * Format:  <base64url(payload JSON)>.<base64url(HMAC-SHA256)>
 *
 * The payload carries the Discord identity rather than a database id, because
 * the two games key their users differently: Aetherbound's User.id IS the
 * Discord snowflake, while the Minecraft project uses a cuid with the
 * snowflake in User.discordId. A Discord id is the only name both understand.
 *
 * It also carries the username and avatar hash. That is not for display -- it
 * means a game that has never seen this player can create their row from the
 * cookie alone, with no call back to the account service. One less thing to be
 * down.
 */
import crypto from 'node:crypto';

/** What a verified token tells you about the person holding it. */
export interface SsoIdentity {
  /** Discord snowflake. The join key across every site on the domain. */
  sub: string;
  /** Discord username (the @handle). */
  username: string;
  /** Discord display name, when they have set one. */
  name: string | null;
  /** Discord avatar hash, not a URL -- each site builds its own CDN link. */
  avatar: string | null;
  /** Expiry, epoch milliseconds. */
  exp: number;
}

/** Thirty days, matching the session cookies this replaces. */
export const SSO_TTL_MS = 1000 * 60 * 60 * 24 * 30;

/** The cookie both projects read. Same name everywhere or SSO does nothing. */
export const SSO_COOKIE = 'ugolok_sso';

const b64url = (buf: Buffer): string => buf.toString('base64url');

function sign(payload: string, secret: string): string {
  return b64url(crypto.createHmac('sha256', secret).update(payload).digest());
}

/**
 * Only the account service calls this. The games verify, they never mint --
 * which is the whole point of having one place that owns sign-in.
 */
export function mintSsoToken(
  identity: Omit<SsoIdentity, 'exp'>,
  secret: string,
  ttlMs: number = SSO_TTL_MS,
): string {
  const payload: SsoIdentity = { ...identity, exp: Date.now() + ttlMs };
  const encoded = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  return `${encoded}.${sign(encoded, secret)}`;
}

/**
 * Returns the identity, or null for anything at all suspicious: wrong shape,
 * bad signature, expired. Callers treat null as "not signed in" -- there is
 * nothing useful to tell the user apart from that, and saying more would tell
 * an attacker which half of the token they got wrong.
 */
export function verifySsoToken(raw: string | undefined, secret: string): SsoIdentity | null {
  if (!raw || !secret) return null;

  const dot = raw.indexOf('.');
  if (dot < 1 || dot === raw.length - 1) return null;

  const encoded = raw.slice(0, dot);
  const provided = raw.slice(dot + 1);
  const expected = sign(encoded, secret);

  // Compare via fixed-length digests rather than the raw strings: timingSafeEqual
  // throws on a length mismatch, and that throw is itself an oracle for the
  // signature length.
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  if (!crypto.timingSafeEqual(a, b)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const claim = parsed as Record<string, unknown>;

  if (typeof claim.sub !== 'string' || !claim.sub) return null;
  if (typeof claim.username !== 'string' || !claim.username) return null;
  if (typeof claim.exp !== 'number' || !Number.isFinite(claim.exp)) return null;
  if (claim.exp < Date.now()) return null;

  return {
    sub: claim.sub,
    username: claim.username,
    name: typeof claim.name === 'string' ? claim.name : null,
    avatar: typeof claim.avatar === 'string' ? claim.avatar : null,
    exp: claim.exp,
  };
}

/**
 * Where a sign-in may return to.
 *
 * `next` arrives in a query string, so it is attacker-controlled: without this
 * check the account site is an open redirector that hands a freshly minted
 * session to whatever host the link named. Only https on the configured
 * domain or one of its subdomains passes, plus plain-http localhost so that
 * development works without a certificate.
 */
export function isAllowedReturnTo(target: string, siteDomain: string, allowLocalhost: boolean): boolean {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return false;
  }

  if (allowLocalhost && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
    return url.protocol === 'http:' || url.protocol === 'https:';
  }

  if (url.protocol !== 'https:') return false;
  if (!siteDomain) return false;

  const host = url.hostname.toLowerCase();
  const domain = siteDomain.toLowerCase();
  return host === domain || host.endsWith(`.${domain}`);
}
