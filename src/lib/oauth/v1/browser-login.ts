import crypto from 'node:crypto';

/**
 * Browser login security state for AUTH_SERVICE_MOBILE_PUBLIC_OAUTH_V1
 * CTR-MPO-001 item 8 (cookie boundary + credential POST CSRF protection).
 *
 * Frozen owner values enforced here (spec §1.1):
 *   AUTH_PUBLIC_ORIGIN = https://auth.mayf3.com (CSRF_ORIGIN_POLICY = EXACT);
 *   AUTH_UI_COOKIE_PREFIX = __Host-, Secure, HttpOnly, SameSite=Lax, Path=/,
 *   no Domain attribute, non-persistent across sessions, not JS-readable;
 *   AUTH_UI_CSRF_MODE = SERVER_SIDE_SYNCHRONIZER_TOKEN with entropy >= 128
 *   bits, bound to the authorization transaction AND the browser session,
 *   hidden-form-field delivery, constant-time comparison, SINGLE_USE.
 *
 * Mechanism notes (spec §13 leaves the implementation mechanism open): the
 * synchronizer state is held in this in-process store, keyed by the
 * server-generated authorization transaction id and bound to a random browser
 * session id carried by the __Host- cookie. A process restart or a second
 * instance holds no record, so outstanding browser logins fail closed (they
 * can never fail open). Only the SHA-256 digest of each CSRF token is
 * retained, and all secret comparisons are timingSafeEqual over digests.
 */

export const AUTH_PUBLIC_ORIGIN = 'https://auth.mayf3.com';
export const BROWSER_LOGIN_PATH = '/oauth/authorize/ui';
export const MOBILE_CALLBACK_PATH = '/mobile/callback';
export const BROWSER_SESSION_COOKIE_NAME = '__Host-auth_ui_session';
export const BROWSER_CSRF_FIELD_NAME = 'csrf_token';

const SECRET_BYTES = 32; // 256-bit, >= CSRF_TOKEN_ENTROPY_MINIMUM (128-bit)
const CSRF_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/; // 32 bytes, base64url

export type BrowserCsrfRejection =
  | 'token_invalid'
  | 'token_expired'
  | 'token_replayed'
  | 'session_mismatch';

export type BrowserCsrfConsumeResult =
  | { outcome: 'accepted' }
  | { outcome: 'rejected'; reason: BrowserCsrfRejection };

export interface BrowserLoginChallenge {
  browserSessionId: string;
  csrfToken: string;
  expiresAt: Date;
}

interface BrowserTransactionRecord {
  browserSessionId: string;
  csrfTokenDigest: Buffer;
  expiresAt: Date;
  used: boolean;
}

function randomSecret(): string {
  return crypto.randomBytes(SECRET_BYTES).toString('base64url');
}

function sha256(value: string): Buffer {
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

/** Constant-time equality for two secret strings via their SHA-256 digests. */
export function secretDigestEquals(left: string, right: string): boolean {
  const a = sha256(left);
  const b = sha256(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function isBrowserCsrfTokenShape(value: unknown): value is string {
  return typeof value === 'string' && CSRF_TOKEN_PATTERN.test(value);
}

export class BrowserLoginStore {
  private readonly records = new Map<string, BrowserTransactionRecord>();

  /**
   * Issue the single active CSRF token for one authorization transaction,
   * bound to one browser session. Issuing again for the same transaction
   * (form re-render) invalidates the previous token for that transaction;
   * passing the current browser session id keeps the same browser session.
   */
  open(
    transactionId: string,
    ttlSeconds: number,
    existingBrowserSessionId?: string | null,
  ): BrowserLoginChallenge {
    const browserSessionId = existingBrowserSessionId ?? randomSecret();
    const csrfToken = randomSecret();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    this.prune();
    this.records.set(transactionId, {
      browserSessionId,
      csrfTokenDigest: sha256(csrfToken),
      expiresAt,
      used: false,
    });
    return { browserSessionId, csrfToken, expiresAt };
  }

  /**
   * Consume a presented CSRF token exactly once (SINGLE_USE). Accepted
   * consumption invalidates the token; every rejection must happen before any
   * credential processing. The raw token is only compared in constant time
   * against the stored digest.
   */
  consume(input: {
    transactionId: string;
    browserSessionId: string | null;
    csrfToken: string;
  }): BrowserCsrfConsumeResult {
    const record = this.records.get(input.transactionId);
    if (!record || !isBrowserCsrfTokenShape(input.csrfToken)) {
      this.prune();
      return { outcome: 'rejected', reason: 'token_invalid' };
    }
    if (record.used) {
      this.prune();
      return { outcome: 'rejected', reason: 'token_replayed' };
    }
    if (record.expiresAt.getTime() <= Date.now()) {
      this.prune();
      return { outcome: 'rejected', reason: 'token_expired' };
    }
    const sessionMatches = typeof input.browserSessionId === 'string'
      && secretDigestEquals(input.browserSessionId, record.browserSessionId);
    if (!sessionMatches) {
      this.prune();
      return { outcome: 'rejected', reason: 'session_mismatch' };
    }
    const presented = sha256(input.csrfToken);
    const tokenMatches = presented.length === record.csrfTokenDigest.length
      && crypto.timingSafeEqual(presented, record.csrfTokenDigest);
    if (!tokenMatches) {
      this.prune();
      return { outcome: 'rejected', reason: 'token_invalid' };
    }
    record.used = true;
    this.prune();
    return { outcome: 'accepted' };
  }

  /** Drop the state for a terminated/completed/expired transaction. */
  close(transactionId: string): void {
    this.records.delete(transactionId);
  }

  private prune(): void {
    const now = Date.now();
    for (const [transactionId, record] of this.records) {
      if (record.expiresAt.getTime() <= now) {
        this.records.delete(transactionId);
      }
    }
  }
}
