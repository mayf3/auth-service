import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSchemaInstance, compileBundleSchemas } from './schemas/validate-instances.mjs';
import { validatePublicJwks, validateSignatureCases, verifyCompactJwt } from './fixtures/verify-compact-jwt.mjs';

const bundleDir = path.dirname(fileURLToPath(import.meta.url));
const errors = [];

function readJson(relativePath) {
  const fullPath = path.join(bundleDir, relativePath);
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (error) {
    throw new Error(`${relativePath}: ${error.message}`);
  }
}

function check(condition, message) {
  if (!condition) errors.push(message);
}

function contractError(code, detail) {
  const error = new Error(detail);
  error.code = code;
  throw error;
}

function isUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

function asciiCompare(left, right) {
  return Buffer.compare(Buffer.from(left, 'ascii'), Buffer.from(right, 'ascii'));
}

function validateScope(scope, audience, manifest) {
  const pattern = new RegExp(manifest.scope_wire_format.item_pattern);
  if (typeof scope !== 'string' || scope.length === 0 || scope.trim() !== scope) {
    contractError('INVALID_SCOPE_WIRE', 'Scope must be a non-empty untrimmed string.');
  }
  const items = scope.split(' ');
  if (items.some((item) => item.length === 0 || !pattern.test(item))) {
    contractError('INVALID_SCOPE_WIRE', 'Scope items or separators are noncanonical.');
  }
  if (new Set(items).size !== items.length) {
    contractError('INVALID_SCOPE_WIRE', 'Duplicate Scope items are forbidden.');
  }
  const sorted = [...items].sort(asciiCompare);
  if (sorted.join(' ') !== scope) {
    contractError('INVALID_SCOPE_WIRE', 'Scope items are not unsigned-ASCII sorted.');
  }
  if (items.some((item) => !item.startsWith(`${audience.scope_namespace}.`))) {
    contractError('INVALID_SCOPE_NAMESPACE', 'Scope is outside the target Audience namespace.');
  }
  if (items.some((item) => !audience.registered_scopes.includes(item))) {
    contractError('INVALID_SCOPE_NAMESPACE', 'Scope is not registered for the target Audience.');
  }
  return items;
}

function assertSubset(requested, grants) {
  const allowed = new Set(grants ?? []);
  if (requested.some((scope) => !allowed.has(scope))) {
    contractError('INVALID_SCOPE_GRANT', 'The complete requested Scope set is not granted.');
  }
}

function validateCommonClaims(claims, manifest, now, ttl) {
  const required = [
    'iss', 'sub', 'aud', 'principal_type', 'client_id', 'token_use', 'type',
    'version', 'jti', 'iat', 'nbf', 'exp',
  ];
  if (required.some((claim) => !(claim in claims))) {
    contractError('MISSING_REQUIRED_CLAIM', 'A required V1 claim is missing.');
  }
  if (claims.iss !== manifest.exact_issuer || claims.version !== manifest.token_version) {
    contractError('INVALID_COMMON_CLAIM', 'Issuer or token version does not match the manifest.');
  }
  if (!isUuid(claims.sub) || typeof claims.client_id !== 'string' || claims.client_id.length === 0) {
    contractError('INVALID_COMMON_CLAIM', 'Principal or Client identity is malformed.');
  }
  if (claims.type !== 'access' || typeof claims.jti !== 'string' || claims.jti.length < 16) {
    contractError('INVALID_COMMON_CLAIM', 'Token type or jti is malformed.');
  }
  if (![claims.iat, claims.nbf, claims.exp].every(Number.isInteger)) {
    contractError('INVALID_NUMERIC_DATE', 'Time claims must be integer NumericDates.');
  }
  if (claims.nbf > claims.iat || claims.exp <= claims.iat) {
    contractError('INVALID_TIME_ORDER', 'Expected nbf <= iat < exp.');
  }
  if (claims.exp - claims.iat > ttl) {
    contractError('TOKEN_TTL_EXCEEDED', 'Token lifetime exceeds its profile maximum.');
  }
  const skew = manifest.timing.clock_skew_tolerance_seconds;
  if (claims.iat > now + skew || claims.nbf > now + skew || claims.exp <= now - skew) {
    contractError('TOKEN_OUTSIDE_TIME_WINDOW', 'Token is outside the accepted clock-skew window.');
  }
}

function validateAllowedClaims(claims, allowed) {
  const unexpected = Object.keys(claims).filter((claim) => !allowed.has(claim));
  if (unexpected.length > 0) {
    contractError('PROFILE_FORBIDDEN_CLAIM', `Forbidden profile claims: ${unexpected.join(',')}`);
  }
}

function validateFixture(fixture, manifest, audienceById, jwksKids, now, options = {}) {
  if (fixture.header?.alg !== 'RS256' || !jwksKids.has(fixture.header?.kid)) {
    contractError('INVALID_JWT_HEADER', 'Fixture header must use RS256 and a known kid.');
  }
  const claims = fixture.claims;
  const audience = audienceById.get(claims?.aud);
  if (!audience) contractError('UNKNOWN_AUDIENCE', 'Token Audience is not registered.');

  if (fixture.profile === 'human_access') {
    validateAllowedClaims(claims, new Set([
      'iss', 'sub', 'aud', 'principal_type', 'client_id', 'token_use', 'type',
      'version', 'jti', 'iat', 'nbf', 'exp',
    ]));
    validateCommonClaims(claims, manifest, now, manifest.timing.human_access_ttl_seconds);
    if (claims.principal_type !== 'user' || claims.token_use !== 'access') {
      contractError('INVALID_PROFILE', 'Human Access requires user and token_use=access.');
    }
    if (!audience.human_access_enabled || !audience.accepted_principal_types.includes('user')) {
      contractError('AUDIENCE_PROFILE_NOT_ACCEPTED', 'Audience does not accept Human Access.');
    }
    if (!fixture.authorization_context?.human_audience_grants?.includes(claims.aud)) {
      contractError('AUDIENCE_NOT_GRANTED', 'Human Client has no grant for the Audience.');
    }
    return;
  }

  if (fixture.profile === 'direct_machine_access') {
    validateAllowedClaims(claims, new Set([
      'iss', 'sub', 'aud', 'principal_type', 'client_id', 'token_use', 'type',
      'version', 'scope', 'agent_id', 'jti', 'iat', 'nbf', 'exp',
    ]));
    validateCommonClaims(claims, manifest, now, manifest.timing.machine_access_ttl_seconds);
    if (!['agent', 'service'].includes(claims.principal_type) || claims.token_use !== 'access') {
      contractError('INVALID_PROFILE', 'Direct Machine Access requires agent/service and token_use=access.');
    }
    if (claims.principal_type === 'service' && 'agent_id' in claims) {
      contractError('PROFILE_FORBIDDEN_CLAIM', 'Service tokens cannot contain agent_id.');
    }
    if (claims.principal_type === 'agent'
      && (typeof claims.agent_id !== 'string' || claims.agent_id.length === 0)) {
      contractError('MISSING_REQUIRED_CLAIM', 'Agent tokens require a non-empty agent_id.');
    }
    if (!audience.machine_access_enabled
      || !audience.accepted_principal_types.includes(claims.principal_type)) {
      contractError('AUDIENCE_PROFILE_NOT_ACCEPTED', 'Audience does not accept the Machine profile.');
    }
    const scopes = validateScope(claims.scope, audience, manifest);
    const requestedScope = fixture.authorization_context?.requested_scope;
    const requestedScopes = validateScope(requestedScope, audience, manifest);
    if (claims.scope !== requestedScope) {
      contractError('SCOPE_OUTPUT_MISMATCH', 'Issued Scope must equal the complete requested Scope.');
    }
    if (!options.skipAuthorization) {
      const grants = fixture.authorization_context?.machine_access_grants?.[claims.aud];
      assertSubset(requestedScopes, grants);
    }
    return;
  }

  if (fixture.profile === 'delegated_access') {
    validateAllowedClaims(claims, new Set([
      'iss', 'sub', 'aud', 'principal_type', 'client_id', 'azp', 'act',
      'token_use', 'type', 'version', 'scope', 'agent_id', 'jti', 'iat', 'nbf', 'exp',
    ]));
    validateCommonClaims(claims, manifest, now, manifest.timing.obo_access_ttl_seconds);
    if (claims.principal_type !== 'agent' || claims.token_use !== 'workflow_obo') {
      contractError('INVALID_PROFILE', 'Delegated Access requires original Agent and workflow_obo.');
    }
    if (claims.azp !== claims.client_id) {
      contractError('OBO_PROXY_CLIENT_MISMATCH', 'OBO azp and client_id must identify the same Proxy Client.');
    }
    if (!isUuid(claims.act?.sub)) {
      contractError('INVALID_ACTOR', 'OBO act.sub must be a Service Principal UUID.');
    }
    if (!audience.delegated_access_enabled || !audience.accepted_principal_types.includes('agent')) {
      contractError('AUDIENCE_PROFILE_NOT_ACCEPTED', 'Audience does not accept Delegated Access.');
    }
    const scopes = validateScope(claims.scope, audience, manifest);
    const context = fixture.authorization_context ?? {};
    const requestedScopes = validateScope(context.requested_scope, audience, manifest);
    if (claims.scope !== context.requested_scope) {
      contractError('SCOPE_OUTPUT_MISMATCH', 'OBO Scope must equal the complete requested Scope.');
    }
    const source = context.source_claims;
    if (!source) contractError('INVALID_SOURCE_TOKEN', 'OBO fixture requires verified source claims.');
    validateFixture({
      profile: 'direct_machine_access',
      header: fixture.header,
      claims: source,
      authorization_context: {
        requested_scope: source.scope,
        machine_access_grants: context.source_machine_access_grants,
      },
    }, manifest, audienceById, jwksKids, now, { skipSigned: true });
    if (source.principal_type !== 'agent' || source.sub !== claims.sub
      || source.token_use !== 'access' || 'act' in source || 'azp' in source) {
      contractError('INVALID_SOURCE_TOKEN', 'Source must be a Direct Agent token for the same sub.');
    }
    if (!context.accepted_subject_audiences?.includes(source.aud)) {
      contractError('SUBJECT_AUDIENCE_NOT_ACCEPTED', 'Proxy does not accept the source Audience.');
    }
    if (claims.exp > source.exp) {
      contractError('OBO_EXCEEDS_SOURCE_EXPIRY', 'OBO expiration exceeds source expiration.');
    }
    assertSubset(requestedScopes, context.original_machine_access_grants?.[claims.aud]);
    assertSubset(requestedScopes, context.proxy_delegation_grants?.[claims.aud]);
    return;
  }

  contractError('UNKNOWN_PROFILE', `Unknown fixture profile: ${fixture.profile}`);
}

function setJsonPointer(target, pointer, value) {
  const parts = pointer.split('/').slice(1).map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'));
  let current = target;
  for (const part of parts.slice(0, -1)) {
    if (!(part in current)) current[part] = {};
    current = current[part];
  }
  current[parts.at(-1)] = value;
}

const manifest = readJson('contract-manifest.json');
const registry = readJson('audience-registry.json');
const freezeGates = readJson('metadata/freeze-gates.json');
const consumerMatrix = readJson('metadata/consumer-verification-matrix.json');
const adcScopeMap = readJson('metadata/adc-v2-scope-map.json');
const llmTodoCandidate = readJson('metadata/llm-todo-authorization-candidate.json');
const jwks = readJson('fixtures/jwks.json');
const positive = readJson('fixtures/positive-token-fixtures.json');
const negative = readJson('fixtures/negative-token-fixtures.json');
const schemaInstances = readJson('fixtures/schema-instances.json');

const requiredSchemas = [
  'contract-manifest.schema.json', 'audience-registry.schema.json',
  'exchange-audit.schema.json', 'grants.schema.json',
  'human-session-refresh.schema.json', 'oauth.schema.json',
  'token-profiles.schema.json', 'trusted-proxy.schema.json',
];
let schemaValidators;
try {
  schemaValidators = compileBundleSchemas(bundleDir, requiredSchemas);
} catch (error) {
  errors.push(`schema compilation: ${error.message}`);
  schemaValidators = new Map();
}
for (const [schemaFile, value, instanceId] of [
  ['contract-manifest.schema.json', manifest, 'contract-manifest'],
  ['audience-registry.schema.json', registry, 'audience-registry'],
]) {
  try {
    assertSchemaInstance(schemaValidators, schemaFile, value, instanceId);
  } catch (error) {
    errors.push(`schema instance: ${error.message}`);
  }
}
for (const instance of schemaInstances.instances) {
  try {
    assertSchemaInstance(schemaValidators, instance.schema_file, instance.value, instance.id);
  } catch (error) {
    errors.push(`schema instance: ${error.message}`);
  }
}

check(manifest.design_id === 'MINIMAL_AUTH_FOUNDATION_V1', 'manifest: wrong design_id');
check(manifest.contract_version === registry.registry_version, 'manifest/registry version mismatch');
check(manifest.contract_version === freezeGates.contract_version, 'manifest/freeze gate version mismatch');
check(manifest.contract_version === consumerMatrix.contract_version, 'manifest/consumer matrix version mismatch');
check(manifest.contract_version === positive.contract_version, 'manifest/positive fixture version mismatch');
check(manifest.contract_version === negative.contract_version, 'manifest/negative fixture version mismatch');
check(manifest.contract_version === schemaInstances.contract_version, 'manifest/schema instance version mismatch');
check(manifest.contract_version === adcScopeMap.contract_version, 'manifest/ADC map version mismatch');
check(manifest.contract_version === llmTodoCandidate.contract_version, 'manifest/llm-todo candidate version mismatch');
check(manifest.signing.algorithm === 'RS256', 'manifest: signing algorithm must be RS256');
check(manifest.signing.allow_hs256_fallback === false, 'manifest: HS256 fallback must be false');
check(manifest.signing.jwks_http_timeout_seconds === 5, 'manifest: JWKS HTTP timeout must be 5s');
check(manifest.profiles.direct_machine_access.token_use === 'access', 'manifest: V0 Direct token_use changed');
check(manifest.profiles.delegated_access.token_use === 'workflow_obo', 'manifest: V0 OBO token_use changed');
check(['client_id', 'jti', 'nbf'].every((claim) => manifest.v0_compatibility.machine_claims_retained.includes(claim)), 'manifest: required V0 claims not retained');
check(manifest.scope_wire_format.separator === 'U+0020', 'manifest: Scope separator must be ASCII space');
check(manifest.timing.human_access_ttl_seconds <= 900, 'manifest: Human Access TTL exceeds 900s');
check(manifest.timing.machine_access_ttl_seconds <= 600, 'manifest: Machine Access TTL exceeds 600s');
check(manifest.timing.obo_access_ttl_seconds <= 300, 'manifest: OBO Access TTL exceeds 300s');
check(manifest.timing.refresh_credential_ttl_seconds <= manifest.timing.human_session_absolute_ttl_seconds, 'manifest: Refresh TTL exceeds Session absolute TTL');
check(manifest.human_login.flow === 'authorization_code', 'manifest: Human login must use Authorization Code');
check(manifest.human_login.pkce_method === 'S256' && manifest.human_login.pkce_required_for_all_clients === true, 'manifest: PKCE S256 must be required for all Human Clients');
check(manifest.human_login.authorization_transaction_ttl_seconds <= 300, 'manifest: Authorization Transaction TTL exceeds 300s');
check(manifest.human_login.authorization_code_ttl_seconds <= 60, 'manifest: Authorization Code TTL exceeds 60s');
check(manifest.human_login.authorization_code_secret_entropy_bits >= 256, 'manifest: Authorization Code entropy is below 256 bits');
check(manifest.human_login.redirect_uri_match === 'exact_string', 'manifest: Redirect URI matching must be exact');
check(manifest.human_login.implicit_grant_allowed === false && manifest.human_login.password_grant_allowed === false, 'manifest: unsafe Human OAuth grant enabled');
check(manifest.refresh_credential.secret_entropy_bits >= 256, 'manifest: Refresh Credential entropy is below 256 bits');
check(manifest.refresh_credential.database_stores_complete_wire_value === false, 'manifest: complete Refresh Credential cannot be stored');
check(manifest.refresh_credential.rotation_expires_at_rule === 'min(now_plus_refresh_ttl,session_absolute_expires_at)', 'manifest: Refresh rotation expiry rule changed');
check(manifest.oauth.request_content_type === 'application/x-www-form-urlencoded', 'manifest: OAuth token request encoding changed');
check(manifest.oauth.reject_duplicate_parameters === true, 'manifest: duplicate OAuth parameters must be rejected');
check(manifest.oauth.success_cache_control === 'no-store' && manifest.oauth.success_pragma === 'no-cache', 'manifest: OAuth success cache headers are incomplete');
check(manifest.oauth.error_cache_control === 'no-store' && manifest.oauth.error_pragma === 'no-cache', 'manifest: OAuth error cache headers are incomplete');
const requiredOauthErrors = {
  invalid_client: 401,
  invalid_grant: 400,
  invalid_request: 400,
  invalid_scope: 400,
  invalid_target: 400,
  unsupported_grant_type: 400,
  unsupported_token_type: 400,
  temporarily_unavailable: 503,
  server_error: 500,
};
check(Object.entries(requiredOauthErrors).every(([code, status]) => manifest.oauth.error_http_status[code] === status), 'manifest: OAuth error/status map is incomplete');
check(manifest.management.grant_management_mode === 'versioned_database_migration_only', 'manifest: V1 grants must be migration managed');
check(manifest.management.online_grant_management_enabled === false, 'manifest: online Grant management must be disabled');
check(manifest.management.optimistic_version_required === true, 'manifest: Grant optimistic concurrency is required');
check(manifest.management.audit_in_same_transaction === true, 'manifest: Grant audit must share the write transaction');
const maximumAccessTtl = Math.max(
  manifest.timing.human_access_ttl_seconds,
  manifest.timing.machine_access_ttl_seconds,
  manifest.timing.obo_access_ttl_seconds,
);
const requiredKeyRetention = maximumAccessTtl
  + manifest.timing.clock_skew_tolerance_seconds
  + manifest.signing.jwks_max_stale_seconds;
check(manifest.signing.key_retention_minimum_seconds >= requiredKeyRetention, 'manifest: signing key retention window is too short');

const contractFreezeBlockers = freezeGates.gates.filter(
  (gate) => gate.blocks_contract_bundle_freeze && gate.status !== 'closed',
);
const productionBlockers = freezeGates.gates.filter(
  (gate) => gate.state_domain === 'production_deployment' && gate.status !== 'closed',
);
const consumerMigrationBlockers = freezeGates.gates.filter(
  (gate) => gate.state_domain === 'consumer_migration' && gate.status !== 'closed',
);
check(
  freezeGates.contract_bundle_freeze_allowed === (contractFreezeBlockers.length === 0),
  'freeze gates: contract_bundle_freeze_allowed contradicts blocking gate states',
);
const freezeState = manifest.lifecycle.contract_bundle_freeze;
const productionState = manifest.lifecycle.production_deployment;
const migrationState = manifest.lifecycle.consumer_migration;
if (freezeState.frozen) {
  check(freezeState.status === 'frozen', 'frozen manifest must have contract_bundle_freeze.status=frozen');
  check(freezeState.implementation_authorized === true, 'frozen Bundle must explicitly authorize implementation');
  check(contractFreezeBlockers.length === 0, 'frozen manifest still has Contract Bundle blockers');
  check(registry.status === 'frozen', 'frozen Bundle requires registry status=frozen');
  check(registry.audiences.every((audience) => audience.freeze_ready), 'frozen registry contains non-ready Audience');
  check(consumerMatrix.all_contract_bundle_scope_fixed_remote_sha, 'frozen Bundle scope has unfixed remote SHAs');
  check(typeof freezeState.reviewed_source_git_commit === 'string'
    && /^[0-9a-f]{40}$/.test(freezeState.reviewed_source_git_commit), 'frozen Bundle requires reviewed source Git SHA');
} else {
  check(freezeState.status === 'draft', 'non-frozen manifest must have contract_bundle_freeze.status=draft');
  check(freezeState.implementation_authorized === false, 'draft Bundle cannot authorize implementation');
  check(freezeState.reviewed_source_git_commit === null, 'draft Bundle cannot claim reviewed source Git SHA');
}
check(productionState.exact_jwks_url === null
  || /^https:\/\//.test(productionState.exact_jwks_url), 'production exact JWKS URL must be null or HTTPS');
if (productionState.status === 'not_ready') {
  check(productionState.exact_jwks_url === null, 'not-ready production state cannot claim exact JWKS URL');
  check(productionState.production_jwks_deployment_ready === false, 'not-ready production state cannot claim JWKS ready');
  check(productionState.auth_token_contract_v1_production_effective === false, 'not-ready production state cannot be effective');
}
if (productionState.auth_token_contract_v1_production_effective) {
  check(productionState.status === 'effective', 'production effective flag requires effective status');
  check(productionState.production_jwks_deployment_ready === true, 'production effective requires JWKS deployment ready');
  check(typeof productionState.exact_jwks_url === 'string', 'production effective requires exact JWKS URL');
  check(productionBlockers.length === 0, 'production effective still has deployment blockers');
}
check(JSON.stringify(migrationState.first_wave_scope) === JSON.stringify(consumerMatrix.contract_bundle_scope), 'manifest/consumer matrix first-wave scope mismatch');
check(migrationState.status !== 'complete' || consumerMatrix.all_first_wave_migrations_ready, 'complete migration state lacks ready evidence');
for (const gate of freezeGates.gates) {
  check(['contract_bundle_freeze', 'production_deployment', 'consumer_migration'].includes(gate.state_domain), `freeze gate ${gate.id}: unknown state domain`);
  check(typeof gate.blocks_contract_bundle_freeze === 'boolean', `freeze gate ${gate.id}: missing Bundle blocker flag`);
  check(['open', 'closed', 'deferred'].includes(gate.status), `freeze gate ${gate.id}: invalid status`);
  check(gate.state_domain === 'contract_bundle_freeze' || !gate.blocks_contract_bundle_freeze, `freeze gate ${gate.id}: non-contract state blocks Bundle freeze`);
}
const firstWaveConsumers = consumerMatrix.consumers.filter((consumer) => consumer.contract_bundle_scope);
check(firstWaveConsumers.length === consumerMatrix.contract_bundle_scope.length, 'consumer matrix: first-wave entry count mismatch');
check(firstWaveConsumers.every((consumer) => consumer.fixed_remote_sha), 'consumer matrix: first-wave remote SHA is not fixed');
check(firstWaveConsumers.every((consumer) => consumerMatrix.contract_bundle_scope.includes(consumer.id)), 'consumer matrix: undeclared first-wave consumer');
check(consumerMatrix.consumers.filter((consumer) => !consumer.contract_bundle_scope)
  .every((consumer) => consumer.migration_status === 'legacy_out_of_scope'), 'consumer matrix: out-of-scope consumer is not Legacy');

const audienceIds = registry.audiences.map((audience) => audience.audience_id);
const audienceById = new Map(registry.audiences.map((audience) => [audience.audience_id, audience]));
check(new Set(audienceIds).size === audienceIds.length, 'registry: duplicate Audience ID');
check([...audienceIds].sort(asciiCompare).join('\0')
  === ['adc-v2', 'agent-core-notification-ingress-v1', 'svc-auth', 'svc-forum', 'svc-okr', 'svc-workflow'].sort(asciiCompare).join('\0'), 'registry: first-wave Audience set changed');
check(!audienceIds.includes('agent-forum'), 'registry: repository name agent-forum cannot be a Wire Audience');
check(!audienceIds.includes('workflow-todo'), 'registry: workflow-todo is a Client, not a resource Audience');
for (const audience of registry.audiences) {
  check(/^[a-z][a-z0-9-]*$/.test(audience.audience_id), `registry: invalid Audience ${audience.audience_id}`);
  check(/^[a-z][a-z0-9-]*$/.test(audience.scope_namespace), `registry: invalid namespace for ${audience.audience_id}`);
  check(new Set(audience.accepted_principal_types).size === audience.accepted_principal_types.length, `registry: duplicate principal type for ${audience.audience_id}`);
  check(audience.registered_scopes.every((scope) => scope.startsWith(`${audience.scope_namespace}.`)), `registry: wrong Scope namespace for ${audience.audience_id}`);
  check([...audience.registered_scopes].sort(asciiCompare).join('\0') === audience.registered_scopes.join('\0'), `registry: Scopes not ASCII sorted for ${audience.audience_id}`);
  check(!audience.human_access_enabled || audience.accepted_principal_types.includes('user'), `registry: Human Audience ${audience.audience_id} does not accept user`);
  check(!audience.machine_access_enabled || audience.accepted_principal_types.some((type) => type === 'agent' || type === 'service'), `registry: Machine Audience ${audience.audience_id} has no machine principal type`);
  check(!(audience.machine_access_enabled || audience.delegated_access_enabled) || audience.registered_scopes.length > 0, `registry: Machine Audience ${audience.audience_id} has no Scopes`);
}

check(adcScopeMap.consumer_git_sha === 'ddeeab2ff394af64b78d9820c9e64d5bf0952ebd', 'ADC Scope map: unexpected consumer SHA');
const adcAudience = audienceById.get(adcScopeMap.source_audience);
const workflowAudience = audienceById.get(adcScopeMap.target_audience);
check(Boolean(adcAudience && workflowAudience), 'ADC Scope map: source or target Audience missing');
for (const route of adcScopeMap.protected_routes) {
  check(adcAudience?.registered_scopes.includes(route.required_source_scope), `ADC Scope map: unregistered source Scope for ${route.method} ${route.path}`);
  check(route.requested_target_scopes.length > 0, `ADC Scope map: empty target Scope for ${route.method} ${route.path}`);
  check(route.requested_target_scopes.every((scope) => workflowAudience?.registered_scopes.includes(scope)), `ADC Scope map: unregistered target Scope for ${route.method} ${route.path}`);
}

check(llmTodoCandidate.decision_status === 'owner_review_required', 'llm-todo matrix: unresolved decisions must remain explicit');
check(llmTodoCandidate.matching_rule === 'most_specific_path_pattern_wins_and_any_tie_denies', 'llm-todo matrix: route matching must fail closed');
check(llmTodoCandidate.consumer_git_sha === '7cc746240ba15161a5350bbe4c6d8fb88f41f5c6', 'llm-todo matrix: unexpected consumer SHA');
check(llmTodoCandidate.artifact_class === 'legacy_consumer_migration_candidate', 'llm-todo matrix: wrong artifact class');
check(llmTodoCandidate.blocks_contract_bundle_freeze === false, 'llm-todo matrix: Legacy candidate blocks Bundle freeze');
check(!audienceById.has(llmTodoCandidate.audience), 'llm-todo matrix: Legacy Audience leaked into first-wave registry');
for (const group of llmTodoCandidate.route_groups) {
  check(group.path_patterns.length > 0, `llm-todo matrix: empty route group ${group.id}`);
  check(group.authentication === 'public' || group.authentication === 'public_candidate' || group.authentication === 'v1_required', `llm-todo matrix: unknown auth mode for ${group.id}`);
  check(group.machine_scope === null || llmTodoCandidate.candidate_scopes.includes(group.machine_scope), `llm-todo matrix: unknown candidate Scope for ${group.id}`);
  check(group.authentication === 'v1_required' || group.machine_scope === null, `llm-todo matrix: public route cannot require Machine Scope for ${group.id}`);
}

let jwksKids = new Set();
try {
  jwksKids = validatePublicJwks(jwks);
} catch (error) {
  errors.push(`JWKS fixture: ${error.code ?? 'ERROR'} ${error.message}`);
}
const positiveByName = new Map();
for (const fixture of positive.fixtures) {
  try {
    verifyCompactJwt(fixture.compact_jwt, jwks, fixture.header, fixture.claims);
    assertSchemaInstance(
      schemaValidators,
      'token-profiles.schema.json',
      fixture.claims,
      `positive-token-${fixture.name}`,
    );
    validateFixture(fixture, manifest, audienceById, jwksKids, positive.now);
    positiveByName.set(fixture.name, fixture);
  } catch (error) {
    errors.push(`positive fixture ${fixture.name}: ${error.code ?? 'ERROR'} ${error.message}`);
  }
}

for (const error of validateSignatureCases(negative.signature_cases, positiveByName, jwks)) {
  errors.push(`signature fixture ${error}`);
}
check(positiveByName.size === positive.fixtures.length, 'positive fixture names must be unique and valid');

for (const testCase of negative.cases) {
  const base = positiveByName.get(testCase.base_fixture);
  if (!base) {
    errors.push(`negative fixture ${testCase.name}: unknown base fixture ${testCase.base_fixture}`);
    continue;
  }
  const mutated = structuredClone(base);
  for (const mutation of testCase.mutations) {
    if (mutation.op !== 'set') {
      errors.push(`negative fixture ${testCase.name}: unsupported mutation ${mutation.op}`);
      continue;
    }
    setJsonPointer(mutated, mutation.path, mutation.value);
  }
  try {
    validateFixture(mutated, manifest, audienceById, jwksKids, positive.now);
    errors.push(`negative fixture ${testCase.name}: unexpectedly accepted`);
  } catch (error) {
    if (error.code !== testCase.expected_error) {
      errors.push(`negative fixture ${testCase.name}: expected ${testCase.expected_error}, got ${error.code ?? 'ERROR'} (${error.message})`);
    }
  }
}

for (const relativePath of [
  'README.md', 'contract-manifest.json', 'audience-registry.json',
  'metadata/change-log.md', 'metadata/consumer-verification-matrix.json',
  'metadata/freeze-gates.json', 'metadata/adc-v2-scope-map.json',
  'metadata/llm-todo-authorization-candidate.json',
]) {
  check(fs.existsSync(path.join(bundleDir, relativePath)), `missing required artifact: ${relativePath}`);
}

if (errors.length > 0) {
  console.error('MINIMAL_AUTH_V1_BUNDLE_VALID=false');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`MINIMAL_AUTH_V1_BUNDLE_VALID=true\nCONTRACT_BUNDLE_FREEZE=${freezeState.status.toUpperCase()}\nCONTRACT_BUNDLE_FROZEN=${freezeState.frozen}\nPRODUCTION_DEPLOYMENT=${productionState.status.toUpperCase()}\nPRODUCTION_JWKS_DEPLOYMENT_READY=${productionState.production_jwks_deployment_ready}\nAUTH_TOKEN_CONTRACT_V1_PRODUCTION_EFFECTIVE=${productionState.auth_token_contract_v1_production_effective}\nCONSUMER_MIGRATION=${migrationState.status.toUpperCase()}\nCONSUMER_MIGRATION_IN_SCOPE_READY=${migrationState.in_scope_ready}\nLEGACY_CONSUMERS_MIGRATED=${migrationState.legacy_consumers_migrated}\nCONTRACT_FREEZE_BLOCKER_COUNT=${contractFreezeBlockers.length}\nPRODUCTION_BLOCKER_COUNT=${productionBlockers.length}\nCONSUMER_MIGRATION_BLOCKER_COUNT=${consumerMigrationBlockers.length}`);
  console.log(`SCHEMA_COUNT=${requiredSchemas.length}\nSCHEMA_INSTANCE_COUNT=${schemaInstances.instances.length}\nPOSITIVE_FIXTURE_COUNT=${positive.fixtures.length}\nNEGATIVE_FIXTURE_COUNT=${negative.cases.length + negative.signature_cases.length}`);
}
