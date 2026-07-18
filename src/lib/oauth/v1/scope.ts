import { V1OAuthError } from './errors.js';

const SCOPE_PATTERN = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9._-]*$/;

function unsignedAsciiSort(left: string, right: string): number {
  return Buffer.from(left, 'ascii').compare(Buffer.from(right, 'ascii'));
}

export function parseV1ScopeRequest(scope: string, namespace: string): readonly string[] {
  if (!scope || scope.startsWith(' ') || scope.endsWith(' ') || scope.includes('  ')) {
    throw new V1OAuthError('invalid_scope', 'scope_spacing_invalid');
  }
  if (/[^\x20-\x7e]/.test(scope) || /\s/.test(scope.replaceAll(' ', ''))) {
    throw new V1OAuthError('invalid_scope', 'scope_character_invalid');
  }
  const values = scope.split(' ');
  if (new Set(values).size !== values.length) {
    throw new V1OAuthError('invalid_scope', 'scope_duplicate');
  }
  if (values.some((value) => !SCOPE_PATTERN.test(value))) {
    throw new V1OAuthError('invalid_scope', 'scope_shape_invalid');
  }
  if (values.some((value) => value.slice(0, value.indexOf('.')) !== namespace)) {
    throw new V1OAuthError('invalid_scope', 'scope_namespace_invalid');
  }
  return [...values].sort(unsignedAsciiSort);
}

export function canonicalV1Scope(scope: string, namespace: string): string {
  return parseV1ScopeRequest(scope, namespace).join(' ');
}

export function assertCanonicalV1Scope(scope: string, namespace: string): readonly string[] {
  const parsed = parseV1ScopeRequest(scope, namespace);
  if (scope !== parsed.join(' ')) {
    throw new V1OAuthError('invalid_scope', 'scope_not_canonical');
  }
  return parsed;
}
