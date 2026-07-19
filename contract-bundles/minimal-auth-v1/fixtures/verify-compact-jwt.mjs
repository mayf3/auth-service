import crypto from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

function fixtureError(code, detail) {
  const error = new Error(detail);
  error.code = code;
  throw error;
}

function decodeSegment(segment, label) {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) {
    fixtureError('INVALID_COMPACT_JWT', `${label} is not canonical base64url.`);
  }
  let bytes;
  try {
    bytes = Buffer.from(segment, 'base64url');
  } catch {
    fixtureError('INVALID_COMPACT_JWT', `${label} cannot be decoded.`);
  }
  if (bytes.toString('base64url') !== segment) {
    fixtureError('INVALID_COMPACT_JWT', `${label} is not canonical base64url.`);
  }
  return bytes;
}

function decodeJson(segment, label) {
  try {
    return JSON.parse(decodeSegment(segment, label).toString('utf8'));
  } catch (error) {
    if (error.code) throw error;
    fixtureError('INVALID_COMPACT_JWT', `${label} is not JSON.`);
  }
}

export function verifyCompactJwt(compactJwt, jwks, expectedHeader, expectedClaims) {
  if (typeof compactJwt !== 'string') {
    fixtureError('MISSING_COMPACT_JWT', 'Fixture has no compact JWT.');
  }
  const parts = compactJwt.split('.');
  if (parts.length !== 3) {
    fixtureError('INVALID_COMPACT_JWT', 'Compact JWT must have three segments.');
  }
  const [protectedSegment, payloadSegment, signatureSegment] = parts;
  const header = decodeJson(protectedSegment, 'protected header');
  const claims = decodeJson(payloadSegment, 'payload');
  if (header.alg !== 'RS256') {
    fixtureError('INVALID_JWT_ALGORITHM', 'Only RS256 fixtures are accepted.');
  }
  if (typeof header.kid !== 'string' || header.kid.length === 0) {
    fixtureError('MISSING_JWT_KID', 'Fixture header has no kid.');
  }
  const jwk = jwks.keys.find((candidate) => candidate.kid === header.kid);
  if (!jwk) fixtureError('UNKNOWN_JWT_KID', 'Fixture kid is absent from JWKS.');
  const signature = decodeSegment(signatureSegment, 'signature');
  let valid = false;
  try {
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    valid = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${protectedSegment}.${payloadSegment}`, 'ascii'),
      publicKey,
      signature,
    );
  } catch {
    fixtureError('INVALID_JWKS_KEY', 'JWKS fixture key cannot verify RS256.');
  }
  if (!valid) fixtureError('INVALID_JWT_SIGNATURE', 'Compact JWT signature is invalid.');
  if (!isDeepStrictEqual(header, expectedHeader) || !isDeepStrictEqual(claims, expectedClaims)) {
    fixtureError('SIGNED_FIXTURE_MISMATCH', 'Signed JWT does not match declared header/claims.');
  }
}

export function mutateProtectedHeader(compactJwt, patch) {
  const parts = compactJwt.split('.');
  const header = decodeJson(parts[0], 'protected header');
  parts[0] = Buffer.from(JSON.stringify({ ...header, ...patch })).toString('base64url');
  return parts.join('.');
}

export function corruptSignature(compactJwt) {
  const parts = compactJwt.split('.');
  const signature = decodeSegment(parts[2], 'signature');
  signature[0] ^= 1;
  parts[2] = signature.toString('base64url');
  return parts.join('.');
}

export function validatePublicJwks(jwks) {
  const privateFields = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth'];
  if (!Array.isArray(jwks.keys) || jwks.keys.length === 0) {
    fixtureError('INVALID_JWKS_KEY', 'JWKS fixture has no keys.');
  }
  const kids = new Set();
  for (const key of jwks.keys) {
    if (key.kty !== 'RSA' || key.use !== 'sig' || key.alg !== 'RS256'
      || typeof key.n !== 'string' || typeof key.e !== 'string'
      || typeof key.kid !== 'string' || privateFields.some((field) => field in key)
      || kids.has(key.kid)) {
      fixtureError('INVALID_JWKS_KEY', 'JWKS fixture contains an invalid or duplicate public key.');
    }
    kids.add(key.kid);
  }
  return kids;
}

export function validateSignatureCases(cases, positiveByName, jwks) {
  const errors = [];
  for (const testCase of cases) {
    const base = positiveByName.get(testCase.base_fixture);
    if (!base) {
      errors.push(`${testCase.name}: unknown base fixture ${testCase.base_fixture}`);
      continue;
    }
    let compactJwt;
    if (testCase.mutation === 'corrupt_signature') {
      compactJwt = corruptSignature(base.compact_jwt);
    } else if (testCase.mutation === 'set_alg_hs256') {
      compactJwt = mutateProtectedHeader(base.compact_jwt, { alg: 'HS256' });
    } else if (testCase.mutation === 'set_unknown_kid') {
      compactJwt = mutateProtectedHeader(base.compact_jwt, { kid: 'unknown-fixture-key' });
    } else {
      errors.push(`${testCase.name}: unsupported mutation ${testCase.mutation}`);
      continue;
    }
    try {
      verifyCompactJwt(compactJwt, jwks, base.header, base.claims);
      errors.push(`${testCase.name}: unexpectedly accepted`);
    } catch (error) {
      if (error.code !== testCase.expected_error) {
        errors.push(`${testCase.name}: expected ${testCase.expected_error}, got ${error.code ?? 'ERROR'} (${error.message})`);
      }
    }
  }
  return errors;
}
