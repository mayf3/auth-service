import crypto from 'node:crypto';
import { getV1ContractSettings } from './contract.js';

const UUID_V4 = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const CODE_PATTERN = new RegExp(`^ac1\\.(${UUID_V4})\\.([A-Za-z0-9_-]{43})$`);
const REFRESH_PATTERN = new RegExp(`^rc1\\.(${UUID_V4})\\.([A-Za-z0-9_-]{43})$`);

export interface OpaqueCredential {
  id: string;
  secret: string;
  wireValue: string;
  verifier: string;
  verifierParametersVersion: string;
}

function verifier(secret: string, salt = crypto.randomBytes(
  getV1ContractSettings().refreshVerifier.saltLengthBytes,
)): string {
  const settings = getV1ContractSettings().refreshVerifier;
  const derived = crypto.scryptSync(secret, salt, settings.keyLengthBytes, {
    N: settings.N,
    r: settings.r,
    p: settings.p,
  });
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

function issue(prefix: 'ac1' | 'rc1'): OpaqueCredential {
  const id = crypto.randomUUID();
  const secret = crypto.randomBytes(32).toString('base64url');
  return {
    id,
    secret,
    wireValue: `${prefix}.${id}.${secret}`,
    verifier: verifier(secret),
    verifierParametersVersion: getV1ContractSettings().refreshVerifier.parametersVersion,
  };
}

export function issueAuthorizationCodeCredential(): OpaqueCredential {
  return issue('ac1');
}

export function issueRefreshCredential(): OpaqueCredential {
  return issue('rc1');
}

export function parseAuthorizationCode(value: string): { id: string; secret: string } | null {
  const match = CODE_PATTERN.exec(value);
  return match ? { id: match[1], secret: match[2] } : null;
}

export function parseRefreshCredential(value: string): { id: string; secret: string } | null {
  const match = REFRESH_PATTERN.exec(value);
  return match ? { id: match[1], secret: match[2] } : null;
}

export function verifyOpaqueSecret(
  secret: string,
  storedVerifier: string,
  parametersVersion: string,
): boolean {
  const settings = getV1ContractSettings().refreshVerifier;
  if (parametersVersion !== settings.parametersVersion) return false;
  const separator = storedVerifier.indexOf(':');
  if (separator < 1) return false;
  try {
    const salt = Buffer.from(storedVerifier.slice(0, separator), 'hex');
    const expected = Buffer.from(storedVerifier.slice(separator + 1), 'hex');
    if (salt.length !== settings.saltLengthBytes || expected.length !== settings.keyLengthBytes) {
      return false;
    }
    const actual = crypto.scryptSync(secret, salt, settings.keyLengthBytes, {
      N: settings.N,
      r: settings.r,
      p: settings.p,
    });
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function pkceS256(verifierValue: string): string {
  return crypto.createHash('sha256').update(verifierValue, 'ascii').digest('base64url');
}
