/** Bounded AUTH_SERVICE_MCP_CONVERSATION_PILOT_SUPPLY_V2 source vehicle.
 * Native authenticated origin and the original retained window gate production.
 * The import-only isolated seam uses the identical DB/OS engine, never production paths.
 * PostgreSQL and private file persistence are deliberately separate boundaries.
 */
import { z } from 'zod';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, realpathSync, lstatSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { parse as parseDotenv } from 'dotenv';
import { validateArtifact } from './start-auth-mcp-release-v1.js';
import { generateClientSecret, hashClientSecret, verifyClientSecret } from '../src/lib/oauth/secret.js';

export const FIXED = Object.freeze({
  externalRef: 'dot-read-mcp-native-conversation-pilot-v1', displayName: 'dot native conversation pilot v1',
  resource: 'agent-core-mcp-conversation-v1', scope: 'conversation.access',
  communicationScope: 'mcp-native-conversation-pilot-v1',
  destination: '/Users/yanfenma/.config/read-mcp/native-conversation.service-v1.client.json',
  escrow: '/Users/yanfenma/.config/read-mcp/.native-conversation-pilot-v1-escrow', uid: 502, gid: 20,
});
export const AUDIENCE = Object.freeze({ audienceId: FIXED.resource, resourceService: FIXED.resource,
  scopeNamespace: 'conversation', acceptedPrincipalTypes: ['service'], registeredScopes: [FIXED.scope],
  humanAccessEnabled: false, machineAccessEnabled: true, delegatedAccessEnabled: false,
  status: 'active' as const, freezeReady: true, version: 1 });
const PRODUCT = Object.freeze({ agent_id: 'agt_build-in-public-agent',
  target_principal_id: 'd5b3aeb2-e754-49a9-9914-b963521c0985', domain_id: 'f9b5682c-1c9c-5ace-a7b1-01b9a3be5965',
  binding_id: 'mcp:dot-native-conversation-pilot-v1', routing_version: 1,
  runtime_root: '/Users/authsvc/.agent-core', endpoint: 'http://127.0.0.1:8788',
  resource: FIXED.resource, scope: FIXED.scope });
const sha = z.string().regex(/^[0-9a-f]{64}$/), git = z.string().regex(/^[0-9a-f]{40}$/);
const ref = z.string().min(1).max(512).regex(/^[A-Za-z0-9_:@./#=-]+$/);
const parentBinding = { parent_delegation_id: z.string().uuid(), parent_delegation_digest: sha };
const common = { schema_version: z.literal(2), ...parentBinding, operation_id: z.string().uuid(), environment: ref,
  source_commit: git, spec_ref: ref, spec_digest: sha, audience_authority_ref: ref, audience_authority_digest: sha,
  bundle_digest: sha, runtime_digest: sha, runtime_preimage_receipt_ref: ref, runtime_preimage_receipt_digest: sha,
  operator_ref: ref, approval_ref: ref, approval_digest: sha.optional(), approval_nonce: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  created_at: z.string().datetime(), expires_at: z.string().datetime() };
const registry = { stop_serving_receipt_ref: ref, stop_serving_receipt_digest: sha };
const requestSchema = z.discriminatedUnion('phase', [
  z.object({ ...common, phase: z.literal('registry'), ...registry }).strict(),
  z.object({ ...common, phase: z.literal('registry-disable'), ...registry }).strict(),
  z.object({ ...common, phase: z.literal('registry-migrate-agent-v1'), ...registry }).strict(),
  z.object({ ...common, phase: z.literal('registry-disable-migrated'), ...registry }).strict(),
  z.object({ ...common, phase: z.literal('supply'), connector_config_receipt_ref: ref,
    connector_config_receipt_digest: sha, connector_subject: z.string().uuid(), registry_receipt_ref: ref,
    registry_receipt_digest: sha }).strict(),
]);
const recoveryRequestSchema = z.object({ schema_version: z.literal(2), phase: z.literal('recover-delivery'), ...parentBinding,
  operation_id: z.string().uuid(), original_supply_operation_id: z.string().uuid(), original_supply_request_digest: sha,
  original_supply_receipt_digest: sha, source_commit: git, spec_ref: ref, spec_digest: sha, operator_ref: ref, approval_ref: ref,
  approval_nonce: common.approval_nonce, created_at: z.string().datetime(), expires_at: z.string().datetime(), approval_digest: sha.optional() }).strict();
export type RecoveryRequest = z.infer<typeof recoveryRequestSchema>;
export function parseRecoveryRequest(raw: string): RecoveryRequest { return recoveryRequestSchema.parse(parseClosedJson(raw)); }
export type Request = z.infer<typeof requestSchema>;
export type Action = 'plan' | 'apply' | 'verify' | 'reconcile' | 'recover-delivery';
type Json = Record<string, any>;
class Refusal extends Error { constructor(public readonly category: string) { super(category); } }
function insist(ok: unknown, category: string): asserts ok { if (!ok) throw new Refusal(category); }

// A recursive JSON recognizer rejects duplicate decoded keys at every nesting level.
export function parseClosedJson(raw: string, limit = 1024 * 1024): unknown {
  insist(Buffer.byteLength(raw) <= limit, 'INPUT_TOO_LARGE');
  let p = 0; const ws = () => { while (/\s/.test(raw[p] ?? '') && p < raw.length) p++; };
  const str = (): string => { const start = p++; while (p < raw.length) { const c = raw[p++];
    if (c === '\\') { p++; continue; } if (c === '"') return JSON.parse(raw.slice(start, p)); }
    throw new Refusal('INVALID_JSON'); };
  const value = (): void => { ws(); if (raw[p] === '{') { p++; ws(); const seen = new Set<string>();
    if (raw[p] === '}') { p++; return; } while (true) { ws(); insist(raw[p] === '"', 'INVALID_JSON');
      const key = str(); insist(!seen.has(key), 'DUPLICATE_JSON_KEY'); seen.add(key); ws();
      insist(raw[p++] === ':', 'INVALID_JSON'); value(); ws(); const c = raw[p++];
      if (c === '}') return; insist(c === ',', 'INVALID_JSON'); }
    } else if (raw[p] === '[') { p++; ws(); if (raw[p] === ']') { p++; return; }
      while (true) { value(); ws(); const c = raw[p++]; if (c === ']') return; insist(c === ',', 'INVALID_JSON'); }
    } else if (raw[p] === '"') str(); else { const m = raw.slice(p).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
      insist(m, 'INVALID_JSON'); if (!['true','false','null'].includes(m[0])) insist(Number.isSafeInteger(Number(m[0])) && Number(m[0]) >= 0 && String(Number(m[0])) === m[0], 'NONCANONICAL_NUMBER'); p += m[0].length; } };
  try { value(); ws(); insist(p === raw.length, 'INVALID_JSON'); return JSON.parse(raw); }
  catch (e) { if (e instanceof Refusal) throw e; throw new Refusal('INVALID_JSON'); }
}
export function parseRequest(raw: string): Request { try { return requestSchema.parse(parseClosedJson(raw)); }
  catch (e) { if (e instanceof Refusal) throw e; throw new Refusal('INVALID_REQUEST'); } }
export function canonical(value: any): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  insist(value !== undefined && (typeof value !== 'number' || Number.isSafeInteger(value) && value >= 0), 'NONCANONICAL_VALUE');
  return JSON.stringify(value);
}
export function digest(value: unknown): string { const data = canonical(value); return createHash('sha256').update(data).digest('hex'); }
function unsigned(q: Request) { const { approval_digest, ...rest } = q; return rest; }
function planHash(q: Request, prestate: Json, classification: string) { return digest({ request_without_approval_digest: unsigned(q), prestate, classification }); }
function equal(a: unknown, b: unknown) { return canonical(a) === canonical(b); }
function keysEqual(value: Json, keys: string[]) { return equal(Object.keys(value).sort(), keys.sort()); }
function failure(q: Request | undefined, stage: string, category: string, fenced = false, result = 'REFUSED'): Json {
  return { schema_version: 2, result, operation_id: q?.operation_id ?? { state: 'unknown' },
    parent_delegation_id: q?.parent_delegation_id ?? { state: 'unknown' }, parent_delegation_digest: q?.parent_delegation_digest ?? { state: 'unknown' },
    environment: q?.environment ?? { state: 'unknown' }, stage, error_class: category,
    residual_coordinates: { state: fenced ? 'fenced' : 'unobserved', ...(fenced && q ? { operation_id: q.operation_id } : {}) },
    retryable: false, fence_preserved: fenced, observed_at: new Date().toISOString() };
}

// Every emitted object is validated with closed schemas; raw DB JSON never enters a plan.
const absent = z.object({ state: z.literal('absent') }).strict();
const uuid = z.string().uuid(), date = z.string().datetime(), nullableDate = date.nullable();
const principalProjection = z.object({ state: z.literal('present'), id: uuid, principalType: z.enum(['agent', 'service', 'user']),
  agentId: z.string().nullable(), ownerUserId: uuid.nullable(), displayName: z.string().nullable(), externalRef: z.string().nullable(),
  requestDigest: sha.nullable(), status: z.enum(['active', 'disabled']), createdAt: date, updatedAt: date, disabledAt: nullableDate }).strict();
const clientProjection = z.object({ state: z.literal('present'), id: uuid, clientId: z.string(), machinePrincipalId: uuid,
  externalRef: z.string().nullable(), status: z.enum(['active', 'revoked']), allowedResources: z.array(z.string()), allowedScopes: z.array(z.string()),
  createdAt: date, updatedAt: date, rotatedAt: nullableDate, revokedAt: nullableDate }).strict();
const grantProjection = z.object({ state: z.literal('present'), machineClientId: uuid, audienceId: z.string(),
  scopes: z.array(z.string()), version: z.number().int(), createdAt: date, updatedAt: date }).strict();
const audienceProjection = z.object({ state: z.literal('present'), audienceId: z.string(), resourceService: z.string(), scopeNamespace: z.string(),
  acceptedPrincipalTypes: z.array(z.string()), registeredScopes: z.array(z.string()), humanAccessEnabled: z.boolean(), machineAccessEnabled: z.boolean(),
  delegatedAccessEnabled: z.boolean(), status: z.enum(['candidate', 'active', 'disabled', 'retired']), freezeReady: z.boolean(), version: z.number().int(),
  createdAt: date, updatedAt: date }).strict();
const fileIdentity = z.object({ state: z.literal('present'), dev: z.number().int(), ino: z.number().int(), uid: z.number().int(), gid: z.number().int(),
  mode: z.number().int(), size: z.number().int() }).strict();
const directoryIdentity = fileIdentity.omit({ state: true, size: true }).strict();
const stateProjection = z.object({ filesystem_preimage: z.object({ parent_identity: directoryIdentity, escrow_identity: directoryIdentity, ancestor_digest: sha }).strict(), audience: z.union([absent, audienceProjection]), principal: z.array(principalProjection), client: z.array(clientProjection),
  grant: z.array(grantProjection), audit: z.array(z.object({ state: z.literal('present'), id: uuid,
    kind: z.enum(['grant_change_audit', 'auth_security_audit']), timestamp: date }).strict()),
  destination: z.union([absent, fileIdentity, z.object({ state: z.literal('unsafe') }).strict(), z.object({ state: z.literal('not_applicable') }).strict()]),
  non_target_digest: sha }).strict();
const supplyCounts = z.object({ principal: z.number().int().min(0).max(1), client: z.number().int().min(0).max(1),
  grant: z.number().int().min(0).max(1), audit: z.number().int().min(0).max(1) }).strict();
const registryCounts = z.object({ principal: z.literal(0), client: z.literal(0), grant: z.literal(0),
  audience: z.number().int().min(0).max(1), audit: z.number().int().min(0).max(1), credential: z.literal(0) }).strict();
const planSchema = z.object({ schema_version: z.literal(2), phase: z.enum(['registry', 'registry-disable', 'registry-migrate-agent-v1', 'registry-disable-migrated', 'supply']), result: z.literal('PLAN'),
  request: requestSchema, plan_digest: sha, prestate_digest: sha, prestate: stateProjection,
  classification: z.enum(['ABSENT_APPLY', 'DISABLE_APPLY', 'EXACT_AGENT1_MIGRATE', 'EXACT_RERUN_NOOP', 'REFUSED']),
  intended_effect: z.union([registryCounts, supplyCounts.extend({ audience: z.literal(0) }).strict()]),
  approval_nonce: common.approval_nonce, observed_at: date, expires_at: date, native_product_disabled: z.literal(true),
  live_credential_acceptance: z.literal('NOT_RUN'), filesystem_observation: z.literal('separate_non_atomic') }).strict();
const residual = z.union([
  z.object({ state: z.literal('unobserved') }).strict(),
  z.object({ state: z.enum(['fenced', 'proven_not_committed']), operation_id: uuid }).strict(),
  z.object({ state: z.enum(['committed_delivery_incomplete', 'secret_lost']), operation_id: uuid, audit_id: uuid }).strict(),
]);
const unknown = z.object({ state: z.literal('unknown') }).strict();
const failureSchema = z.object({ schema_version: z.literal(2), result: z.enum(['REFUSED', 'ROLLED_BACK', 'OUTCOME_UNKNOWN', 'SECRET_LOST', 'ROLLBACK_INCOMPLETE']),
  parent_delegation_id: z.union([uuid, unknown]), parent_delegation_digest: z.union([sha, unknown]),
  operation_id: z.union([uuid, unknown]), environment: z.union([ref, unknown]), stage: z.string().regex(/^[A-Za-z_-]{1,64}$/),
  error_class: z.string().regex(/^[A-Z_0-9]{1,80}$/), residual_coordinates: residual,
  retryable: z.literal(false), fence_preserved: z.boolean(), observed_at: date }).strict();
const productSchema = z.object(Object.fromEntries(Object.entries(PRODUCT).map(([key, value]) => [key, z.literal(value)]))).strict();
const supplyReceiptSchema = z.object({ schema_version: z.literal(2), ...parentBinding, phase: z.literal('supply'), result: z.enum(['COMMITTED', 'EXACT_RERUN_NOOP']),
  operation_id: uuid, environment: ref, operator_ref: ref, approval_ref: ref, approval_digest: sha.optional(), approval_nonce: common.approval_nonce,
  source_commit: git, spec_ref: ref, spec_digest: sha, plan_digest: sha, prestate_digest: sha, poststate_digest: sha, audit_id: uuid,
  principal_id: uuid, principal_type: z.literal('service'), principal_external_ref: z.literal(FIXED.externalRef), client_row_id: uuid,
  client_id: z.string().regex(/^mc_[A-Za-z0-9_-]{24}$/), client_external_ref: z.literal(FIXED.externalRef), resource: z.literal(FIXED.resource),
  scope: z.literal(FIXED.scope), grant_version: z.literal(1), connector_subject: uuid, connector_config_receipt_ref: ref,
  connector_config_receipt_digest: sha, communication_scope_id: z.literal(FIXED.communicationScope), product_context: productSchema,
  credential_delivery: z.object({ path: z.string(), uid: z.literal(502), gid: z.literal(20), mode: z.literal('0600'), regular: z.literal(true),
    nonsymlink: z.literal(true), secret_matches_verifier: z.literal(true) }).strict(), effect_counts: supplyCounts,
  non_target_digest_before: sha, non_target_digest_after: sha, committed_at: date, verified_at: date }).strict();
const registryReceiptSchema = z.object({ ...common, phase: z.enum(['registry', 'registry-disable', 'registry-migrate-agent-v1', 'registry-disable-migrated']), ...registry,
  result: z.enum(['COMMITTED', 'EXACT_RERUN_NOOP']), plan_digest: sha, prestate_digest: sha, poststate_digest: sha,
  audience_before: z.union([absent, audienceProjection]), audience_after: audienceProjection, audit_id: uuid,
  non_target_digest_before: sha, non_target_digest_after: sha, effect_counts: registryCounts,
  committed_at: date, verified_at: date, runtime_alignment: z.enum(['stopped_pending_load', 'verified_aligned']) }).strict();
const outputSchema = z.union([planSchema, failureSchema, supplyReceiptSchema, registryReceiptSchema]);
export function validatePublicOutput(value: unknown): Json {
  try { return outputSchema.parse(JSON.parse(JSON.stringify(value))); }
  catch { throw new Refusal('OUTPUT_SCHEMA_INVALID'); }
}

/** Inline OS helper: openat-style anchored descriptors, O_NOFOLLOW, exclusive files,
 * linkat no-replace final installation, fsync, inode CAS. No shell or helper file.
 * Private reads use fd3 IPC; stdout/stderr never carry credential bytes.
 */
const OS = String.raw`
import os,sys,json,stat,errno,hashlib,fcntl
x=json.loads(sys.stdin.readline()); root=x['root']; dest=x['destination']; uid=x['uid']; gid=x['gid']; op=x['operation']; cmd=x['cmd']
D=os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW
fds=[]; pins=[]
def check(st,owner,mode=None,file=False):
 if st.st_uid!=owner or (owner==0 and st.st_gid!=0) or (mode is not None and stat.S_IMODE(st.st_mode)!=mode) or (mode is None and stat.S_IMODE(st.st_mode)&0o022): raise Exception('METADATA')
 if file and (not stat.S_ISREG(st.st_mode) or st.st_nlink!=1): raise Exception('FILE_IDENTITY')
def walk(path):
 fd=os.open('/',D); fds.append(fd); walked=''
 for part in path.strip('/').split('/'):
  st=os.fstat(fd)
  if stat.S_IMODE(st.st_mode)&0o022 and not (walked=='/private/tmp' and st.st_uid==0 and st.st_mode&stat.S_ISVTX): raise Exception('ANCESTOR_MODE')
  walked+='/'+part
  nf=os.open(part,D,dir_fd=fd); fds.append(nf); st=os.fstat(nf)
  if st.st_uid not in (0,uid): raise Exception('ANCESTOR_OWNER')
  pins.append((fd,part,st.st_dev,st.st_ino,st.st_uid,st.st_gid,stat.S_IMODE(st.st_mode))); fd=nf
 return fd
def stable():
 for fd,n,dev,ino,owner,group,mode in pins:
  s=os.stat(n,dir_fd=fd,follow_symlinks=False)
  if not stat.S_ISDIR(s.st_mode) or (s.st_dev,s.st_ino,s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode))!=(dev,ino,owner,group,mode): raise Exception('INODE_SWAP')
def info(fd,name,owner,mode):
 try: f=os.open(name,os.O_RDONLY|os.O_NOFOLLOW,dir_fd=fd)
 except FileNotFoundError: return {'state':'absent'}
 try:
  s=os.fstat(f); check(s,owner,mode,True)
  t=os.stat(name,dir_fd=fd,follow_symlinks=False)
  if (s.st_dev,s.st_ino)!=(t.st_dev,t.st_ino): raise Exception('INODE_SWAP')
  return {'state':'present','dev':s.st_dev,'ino':s.st_ino,'uid':s.st_uid,'gid':s.st_gid,'mode':stat.S_IMODE(s.st_mode),'size':s.st_size}
 finally: os.close(f)
def hit(point):
 if x.get('fault')==point: raise Exception('INJECTED')
def write_new(fd,name,data,owner=0,group=0):
 scope='attempt' if name.startswith('attempt-') else 'nonce' if name.startswith('nonce-') else 'recovery_nonce' if name.startswith('recovery-nonce-') else 'private_file'
 f=os.open(name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=fd)
 try:
  os.fchown(f,owner,group); os.fchmod(f,0o600)
  data=data.encode(); pos=0
  while pos<len(data): pos+=os.write(f,data[pos:])
  if x.get('fault')=='before_file_fsync' or (name=='integrity.json' and x.get('fault')=='before_integrity_fsync'): raise Exception('INJECTED')
  hit(scope+':before_file_fsync'); os.fsync(f); hit(scope+':after_file_fsync')
  if x.get('fault')=='after_file_fsync' or (name=='integrity.json' and x.get('fault')=='after_integrity_fsync'): raise Exception('INJECTED')
 finally: os.close(f)
 if name.startswith('ready-') and x.get('fault')=='before_ready_directory_fsync': raise Exception('INJECTED')
 hit(scope+':before_directory_fsync'); os.fsync(fd); hit(scope+':after_directory_fsync')
 if name.startswith('ready-') and x.get('fault')=='after_ready_directory_fsync': raise Exception('INJECTED')
def private_read(fd,name,owner=0):
 f=os.open(name,os.O_RDONLY|os.O_NOFOLLOW,dir_fd=fd)
 try:
  s=os.fstat(f); check(s,owner,0o600,True)
  if s.st_size>16384: raise Exception('FILE_SIZE')
  data=os.read(f,16385); t=os.stat(name,dir_fd=fd,follow_symlinks=False)
  if (s.st_dev,s.st_ino)!=(t.st_dev,t.st_ino): raise Exception('INODE_SWAP')
  return data
 finally: os.close(f)
try:
 r=walk(root); check(os.fstat(r),0,0o700)
 d=walk(os.path.dirname(dest)); check(os.fstat(d),uid,0o700)
 if os.fstat(r).st_dev!=os.fstat(d).st_dev: raise Exception('FILESYSTEM')
 def directory_identity(fd):
  s=os.fstat(fd); return {'dev':s.st_dev,'ino':s.st_ino,'uid':s.st_uid,'gid':s.st_gid,'mode':stat.S_IMODE(s.st_mode)}
 parent_identity=directory_identity(d); escrow_identity=directory_identity(r)
 if x.get('expected_parent') and x['expected_parent']!=parent_identity: raise Exception('INODE_SWAP')
 if x.get('expected_escrow') and x['expected_escrow']!=escrow_identity: raise Exception('INODE_SWAP')
 if cmd in ('read-destination','read-escrow'):
  if x.get('fault')==cmd+':EIO': raise OSError(errno.EIO,'')
  if x.get('fault')==cmd+':EMFILE': raise OSError(errno.EMFILE,'')
 name=os.path.basename(dest); result={}
 if cmd=='inspect':
  try: dst=info(d,name,uid,0o600)
  except: dst={'state':'unsafe'}
  result={'destination':dst,'fences':[],'recoveries':[], 'parent_identity':parent_identity, 'escrow_identity':escrow_identity,
   'ancestor_identities':[list(pin[2:]) for pin in pins]}
  for n in sorted(os.listdir(r)):
   if n.startswith('attempt-') and n.endswith('.jsonl'):
    raw=private_read(r,n).decode(); records=[json.loads(v) for v in raw.splitlines()]
    result['fences'].append(records)
  for n in sorted(os.listdir(r)):
   if n.startswith('recovery-') and n.endswith('.jsonl'):
    result['recoveries'].append([json.loads(v) for v in private_read(r,n).decode().splitlines()])
  if result['destination']['state']=='present' and result['destination']['gid']!=gid: result['destination']={'state':'unsafe'}
 elif cmd=='hold-lock':
  # Permanent inode, never unlinked: every legitimate apply/recovery locks this same inode.
  lockfd=os.open('operation.lock',os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600,dir_fd=r); fds.append(lockfd)
  s=os.fstat(lockfd); check(s,0,0o600,True)
  fcntl.flock(lockfd,fcntl.LOCK_EX|fcntl.LOCK_NB)
  t=os.stat('operation.lock',dir_fd=r,follow_symlinks=False)
  if (s.st_dev,s.st_ino)!=(t.st_dev,t.st_ino): raise Exception('INODE_SWAP')
  os.fsync(lockfd); os.fsync(r); stable()
  print(json.dumps({'ok':True,'value':{'held':True,'dev':s.st_dev,'ino':s.st_ino,'fd':lockfd,'pid':os.getpid()}}),flush=True)
  # Parent owns the write end. Parent death closes it and releases the kernel lock.
  sys.stdin.readline()
 elif cmd in ('capability-reserve','capability-read'):
  if x['capability'] not in ['registry-migrate-agent-v1','candidate-load','supply','registry-disable-migrated','recover-delivery']: raise Exception('COMMAND')
  n='pilot-capability-'+x['capability']+'.json'
  if cmd=='capability-reserve':
   # Durable pilot-wide tombstone precedes EVERY per-parent claim. Never replaced.
   for old in os.listdir(r):
    if old.startswith('attempt-') and old.endswith('.jsonl'):
     rows=[json.loads(v) for v in private_read(r,old).decode().splitlines()]
     if not rows or rows[0].get('phase')==x['capability']: raise Exception('CAPABILITY_SPENT')
   write_new(r,n,json.dumps(x['record']))
  result=json.loads(private_read(r,n))
 elif cmd=='claim':
  # Nonce files and per-operation fences remain forever. No stale-lock deletion or fence reset.
  write_new(r,'attempt-'+op+'.jsonl',json.dumps(x['record'])+'\n')
  write_new(r,'nonce-'+x['nonce'],json.dumps(x['record']))
 elif cmd=='recovery-claim':
  write_new(r,'recovery-nonce-'+x['nonce'],json.dumps(x['record']))
  if x['record'].get('operation_id')!=op: write_new(r,'recovery-'+x['record']['operation_id']+'.jsonl',json.dumps(x['record'])+'\n')
 elif cmd in ('append','recovery-append'):
  n=('recovery-'+x['recovery_operation'] if cmd=='recovery-append' else 'attempt-'+op)+'.jsonl'; f=os.open(n,os.O_WRONLY|os.O_APPEND|os.O_NOFOLLOW,dir_fd=r)
  try:
   s=os.fstat(f); check(s,0,0o600,True); data=(json.dumps(x['record'])+'\n').encode(); pos=0
   while pos<len(data): pos+=os.write(f,data[pos:])
   scope='ledger:'+x['record']['stage']; hit(scope+':before_file_fsync'); os.fsync(f); hit(scope+':after_file_fsync')
   t=os.stat(n,dir_fd=r,follow_symlinks=False)
   if (s.st_dev,s.st_ino)!=(t.st_dev,t.st_ino): raise Exception('INODE_SWAP')
  finally: os.close(f)
  hit(scope+':before_directory_fsync'); os.fsync(r); hit(scope+':after_directory_fsync')
 elif cmd in ('escrow','install','read-escrow'):
  n='secret-'+op
  if cmd=='escrow':
   os.mkdir(n,0o700,dir_fd=r); os.fsync(r)
  e=os.open(n,D,dir_fd=r); fds.append(e); check(os.fstat(e),0,0o700)
  pins.append((r,n,os.fstat(e).st_dev,os.fstat(e).st_ino,0,0,0o700))
  def verified_escrow():
   data=private_read(e,'credential.json'); integrity=json.loads(private_read(e,'integrity.json'))
   if set(integrity)!=set(('digest','identity')) or integrity['digest']!=hashlib.sha256(data).hexdigest() or integrity['identity']!=info(e,'credential.json',0,0o600): raise Exception('ESCROW_INTEGRITY')
   return data
  if cmd=='escrow':
   write_new(e,'credential.json',x['private']); result=info(e,'credential.json',0,0o600)
   write_new(e,'integrity.json',json.dumps({'digest':hashlib.sha256(x['private'].encode()).hexdigest(),'identity':result}))
  elif cmd=='read-escrow':
   os.write(3,verified_escrow()); result=info(e,'credential.json',0,0o600)
  else:
   if info(d,name,uid,0o600)['state']!='absent': raise Exception('DESTINATION_EXISTS')
   content=verified_escrow().decode()
   ready='ready-'+op
   write_new(e,ready,content,uid,gid)
   stable()
   if x.get('fault')=='before_install': raise Exception('INJECTED')
   os.link(ready,name,src_dir_fd=e,dst_dir_fd=d,follow_symlinks=False)
   if x.get('fault')=='after_install_link': raise Exception('INJECTED')
   os.unlink(ready,dir_fd=e); os.fsync(e); os.fsync(d)
   if x.get('fault')=='after_directory_fsync': raise Exception('INJECTED')
   result=info(d,name,uid,0o600)
 elif cmd=='read-destination':
  os.write(3,private_read(d,name,uid)); result=info(d,name,uid,0o600)
 else: raise Exception('COMMAND')
 stable(); print(json.dumps({'ok':True,'value':result}))
except BaseException as failure:
 # Only literal internal categories or errno numbers, never raw errors/paths.
 allowed={'METADATA','FILE_IDENTITY','ANCESTOR_MODE','ANCESTOR_OWNER','INODE_SWAP','FILE_SIZE','FILESYSTEM','LOCK_IDENTITY','DESTINATION_EXISTS','INJECTED','COMMAND','ESCROW_INTEGRITY','CAPABILITY_SPENT'}
 category=str(failure) if str(failure) in allowed else 'ERRNO_'+str(getattr(failure,'errno',0) or 0)
 print(json.dumps({'ok':False,'error_class':category})); sys.exit(1)
finally:
 for f in reversed(fds):
  try: os.close(f)
  except: pass
`;

type Coordinates = { root: string; destination: string; uid: number; gid: number };
function osCall(c: Coordinates, q: Pick<Request,'operation_id'>, cmd: string, extra: Json = {}): { value: Json; private: Buffer } {
  if (extra.fault === 'helper-unavailable' && (cmd === 'read-destination' || cmd === 'read-escrow')) throw new Refusal('OS_HELPER_UNAVAILABLE');
  const r = spawnSync('/usr/bin/python3', ['-c', OS], { input: JSON.stringify({ ...c, operation: q.operation_id,
    cmd, pid: process.pid, ...extra }), stdio: ['pipe', 'pipe', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 });
  let o: Json; try { o = JSON.parse(r.stdout?.toString() || '{}'); } catch { throw new Refusal('OS_BOUNDARY_FAILURE'); }
  insist(r.status === 0 && o.ok === true && !r.stderr?.length, 'OS_BOUNDARY_' + (/^[A-Z_0-9]{1,48}$/.test(o.error_class) ? o.error_class : 'FAILURE'));
  return { value: o.value, private: (r.output[3] as Buffer) ?? Buffer.alloc(0) };
}
/** The OS helper stays alive with its flock descriptor for the entire mutation.
 * It never rewrites/unlinks the permanent inode. A competing recovery cannot
 * steal it using a stale PID/inode observation. No secret traverses this pipe. */
async function acquireOsLock(c: Coordinates, q: Pick<Request, 'operation_id'>) {
  const child = spawn('/usr/bin/python3', ['-c', OS], { stdio: ['pipe', 'pipe', 'pipe', 'pipe'] });
  let held = false, released = false, output = '', diagnostic = '';
  let exited = false;
  const closed = new Promise<void>(resolve => { child.once('close', () => { exited = true; held = false; resolve(); }); });
  const ready = new Promise<void>((resolveReady, reject) => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Refusal('OS_LOCK_TIMEOUT')); }, 5000);
    child.stdout.on('data', chunk => {
      output += chunk.toString(); const line = output.split('\n')[0];
      try { const parsed = JSON.parse(line); clearTimeout(timer);
        if (parsed.ok === true && parsed.value?.held === true) { held = true; resolveReady(); }
        else { reject(new Refusal('OS_LOCK_BUSY_OR_UNSAFE')); child.stdin.end(); }
      } catch { /* await one complete closed JSON line */ }
    });
    child.stderr.on('data', chunk => { diagnostic += chunk.toString(); });
    child.once('error', () => { clearTimeout(timer); reject(new Refusal('OS_LOCK_UNAVAILABLE')); });
    child.once('close', () => { clearTimeout(timer); if (!released && !held) reject(new Refusal('OS_LOCK_UNAVAILABLE')); });
  });
  child.stdin.on('error', () => { held = false; });
  child.stdin.write(JSON.stringify({ ...c, operation: q.operation_id, cmd: 'hold-lock', pid: process.pid }) + '\n');
  try { await ready; } catch (e) { child.stdin.end(); await closed; throw e; }
  return { identity: { ...JSON.parse(output.split('\n')[0]).value }, assertHeld() { insist(held && !exited && !diagnostic, 'OS_LOCK_LOST'); },
    async release() { released = true; child.stdin.end('release\n'); await closed; } };
}
function fileState(c: Coordinates, q: Request) { return osCall(c, q, 'inspect').value; }
type CredentialObservation = { kind: 'present'; credential: Json } | { kind: 'absent' | 'invalid' | 'unavailable' };
function credentialValue(observed: CredentialObservation): Json | undefined { return observed.kind === 'present' ? observed.credential : undefined; }
function privateCredential(c: Coordinates, q: Request, escrow: boolean, fault?: string): CredentialObservation {
  let observed: { value: Json; private: Buffer };
  try { observed = osCall(c, q, escrow ? 'read-escrow' : 'read-destination', { fault }); }
  catch (e) {
    if (e instanceof Refusal && e.category === 'OS_BOUNDARY_ERRNO_2') return { kind: 'absent' };
    if (e instanceof Refusal && e.category === 'OS_BOUNDARY_ESCROW_INTEGRITY') return { kind: 'invalid' };
    // Metadata/descriptor/IO/helper failures do not prove that original bytes are lost.
    return { kind: 'unavailable' };
  }
  const raw = observed.private;
  try {
    const data = parseClosedJson(raw.toString()) as Json;
    if (!data || !keysEqual(data, ['connector_subject', 'client_id', 'client_secret']) || typeof data.client_secret !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(data.client_secret)) return { kind: 'invalid' };
    Object.defineProperty(data, '__fileIdentity', { value: observed.value });
    return { kind: 'present', credential: data };
  } catch { return { kind: 'invalid' }; } finally { raw.fill(0); }
}

export interface Dependencies {
  consumer_disposition_digest?: string;
  environment: string; source_commit: string; spec_ref: string; spec_digest: string;
  audience_authority_ref: string; audience_authority_digest: string; bundle_digest: string; runtime_digest: string;
  runtime_preimage_receipt_ref: string; runtime_preimage_receipt_digest: string;
  operator_ref: string; executor_uid: number; executor_gid: number;
  original_transport_verified: boolean; native_product_disabled: boolean;
  candidate_validated: boolean; stopped_original_service: boolean; loaded_candidate_db_aligned: boolean;
  stop_serving_receipt_ref?: string; stop_serving_receipt_digest?: string;
  connector_config_receipt_ref?: string; connector_config_receipt_digest?: string; connector_subject?: string;
  registry_receipt_ref?: string; registry_receipt_digest?: string;
}
const dependenciesSchema = z.object({ environment:ref,source_commit:git,spec_ref:ref,spec_digest:sha,audience_authority_ref:ref,audience_authority_digest:sha,
  bundle_digest:sha,runtime_digest:sha,runtime_preimage_receipt_ref:ref,runtime_preimage_receipt_digest:sha,operator_ref:ref,
  executor_uid:z.literal(502),executor_gid:z.literal(20),original_transport_verified:z.boolean(),native_product_disabled:z.boolean(),
  candidate_validated:z.boolean(),stopped_original_service:z.boolean(),loaded_candidate_db_aligned:z.boolean(),
  stop_serving_receipt_ref:ref.optional(),stop_serving_receipt_digest:sha.optional(),connector_config_receipt_ref:ref.optional(),
  connector_config_receipt_digest:sha.optional(),connector_subject:uuid.optional(),registry_receipt_ref:ref.optional(),registry_receipt_digest:sha.optional(),
  consumer_disposition_digest:sha.optional() }).strict();
export interface Mandate {
  issuer: string; actor: string; environment: string;
  operation_id: string; approval_ref: string; approval_digest: string; approval_nonce: string;
  plan_digest: string; action: 'apply' | 'recover-delivery'; expires_at: string; attempts_max: 1; recovery_nonce?: string;
}
export interface IsolatedOptions {
  root: string; databaseUrl: string; uid: 502; gid: 20;
  dependencies: (q: Request, mode?: 'live' | 'recorded') => Promise<Dependencies>;
  mandate: (q: Request, action: 'apply' | 'recover-delivery', planDigest: string) => Promise<Mandate | undefined>;
  fault?: (stage: string) => void | Promise<void>;
  osFault?: string | (() => string | undefined);
  lockTimeoutMs?: number;
  originalSupply?: () => Promise<{ request: Request; receipt: Json }>;
}
type Snapshot = { audiences: any[]; principals: any[]; clients: any[]; grants: any[]; security: any[]; audits: any[] };
type Tx = Prisma.TransactionClient;
const migration = (q: Request) => 'mcp-conversation-pilot-v1:' + q.operation_id;
function publicClient(row: any) { if (!row) return { state: 'absent' }; const { secretHash, ...safe } = row; return { state: 'present', ...safe }; }
function tagged(row: any) { return row ? { state: 'present', ...row } : { state: 'absent' }; }
export const LEGACY_AUDIENCE = Object.freeze({ ...AUDIENCE, acceptedPrincipalTypes: ['agent'],
  createdAt: '2026-10-16T05:40:12.780Z', updatedAt: '2026-10-16T05:40:12.780Z' });
function migratedExact(row: any, disabled = false) {
  if (!row) return false;
  const { updatedAt, ...rest } = row;
  return equal(rest, { ...AUDIENCE, version: disabled ? 3 : 2, status: disabled ? 'disabled' : 'active',
    freezeReady: !disabled, createdAt: LEGACY_AUDIENCE.createdAt }) && Date.parse(updatedAt) >= Date.parse(LEGACY_AUDIENCE.updatedAt);
}
function audienceExpected(disabled: boolean) { return { ...AUDIENCE, ...(disabled ? { status: 'disabled', freezeReady: false, version: 2 } : {}) }; }
function audienceExact(row: any, disabled: boolean) {
  if (!row) return false; const { createdAt, updatedAt, ...value } = row; return equal(value, audienceExpected(disabled));
}
function auditDetails(q: Request, plan: Json, before: Json, after: Json, nonTarget: string): Json {
  const out: Json = { parent_delegation_id: q.parent_delegation_id, parent_delegation_digest: q.parent_delegation_digest, operation_id: q.operation_id, migration_id: migration(q), source_git_commit: q.source_commit,
    spec_ref: q.spec_ref, spec_digest: q.spec_digest, audience_authority_ref: q.audience_authority_ref,
    audience_authority_digest: q.audience_authority_digest, operator_ref: q.operator_ref, approval_ref: q.approval_ref,
    approval_digest: q.approval_digest ?? { state: 'unsigned' }, approval_nonce: q.approval_nonce, phase: q.phase, plan_digest: plan.plan_digest,
    bundle_digest: q.bundle_digest, runtime_digest: q.runtime_digest, reason: 'bounded-mcp-conversation-pilot-v1',
    before, after, non_target_digest_before: nonTarget, non_target_digest_precommit: nonTarget };
  if (q.phase !== 'supply') Object.assign(out, { stop_serving_receipt_ref: q.stop_serving_receipt_ref,
    stop_serving_receipt_digest: q.stop_serving_receipt_digest });
  else Object.assign(out, { connector_config_receipt_ref: q.connector_config_receipt_ref,
    connector_config_receipt_digest: q.connector_config_receipt_digest, connector_subject: q.connector_subject,
    registry_receipt_ref: q.registry_receipt_ref, registry_receipt_digest: q.registry_receipt_digest });
  return out;
}

/** Only this import seam can instantiate the engine, and only on disposable coordinates.
 * It is NOT a production authorization adapter and is not reachable through CLI/argv/env.
 */
export function createIsolatedVehicle(o: IsolatedOptions) {
  const root = realpathSync(o.root);
  insist(root === o.root && /^\/private\/tmp\/mcs-conformance-[A-Za-z0-9_-]+\/(?:case-[A-Za-z0-9_-]+)$/.test(root), 'NOT_ISOLATED_ROOT');
  const u = new URL(o.databaseUrl);
  insist(u.protocol === 'postgresql:' && u.hostname === '127.0.0.1' && Number(u.port) >= 20000 &&
    /^\/mcs_[a-f0-9]{32}$/.test(u.pathname) && !u.search && !u.password && u.username === 'yanfenma', 'NOT_ISOLATED_DATABASE');
  insist(process.getuid?.() === 0 && o.uid === 502 && o.gid === 20 && lstatSync(root).isDirectory(), 'OS_ACTOR_REQUIRED');
  const c = { root: join(root, 'escrow'), destination: join(root, 'mcp', 'native-conversation.service-v1.client.json'), uid: o.uid, gid: o.gid };
  const db = new PrismaClient({ datasources: { db: { url: o.databaseUrl } }, log: [] });
  return createVehicle({ ...o, environment: 'isolated-conformance', authorityIssuer: 'isolated-independent-owner' }, c, db);
}

/** Original executor integration. A provider requires a validated native-origin custody
 * handle; dependency observations remain the independently measured original actor
 * responsibility. JSON, root status and admin credentials cannot create that origin. */
export interface ProductionTrustedProvider {
  environment: 'production'; authorityIssuer: string; database: PrismaClient; custody: PilotCustody;
  dependencies: IsolatedOptions['dependencies']; mandate: IsolatedOptions['mandate'];
}
export function createProductionVehicle(provider?: ProductionTrustedProvider) {
  insist(provider && provider.environment === 'production' && ref.safeParse(provider.authorityIssuer).success &&
    typeof provider.dependencies === 'function' && typeof provider.mandate === 'function' &&
    provider.database instanceof PrismaClient && (liveCustodies.get(provider.custody?.parent.delegation_id) === provider.custody || readonlyCustodies.has(provider.custody)), 'TRUST_ADAPTER_UNAVAILABLE');
  insist(process.getuid?.() === 0, 'OS_ACTOR_REQUIRED');
  return createVehicle(provider, { root: FIXED.escrow, destination: FIXED.destination, uid: FIXED.uid, gid: FIXED.gid }, provider.database);
}
type EngineOptions = Pick<IsolatedOptions, 'dependencies' | 'mandate' | 'fault' | 'osFault' | 'lockTimeoutMs' | 'originalSupply'> & { environment: string; authorityIssuer: string; custody?: PilotCustody };
function createVehicle(o: EngineOptions, c: Coordinates, db: PrismaClient) {
  const fault = async (stage: string) => { await o.fault?.(stage); };
  const consumerDispositions = new Map<string, string>();
  const osFault = () => typeof o.osFault === 'function' ? o.osFault() : o.osFault;
  async function dependencies(q: Request, mode: 'live' | 'recorded' = 'live') {
    const d = await o.dependencies(q, mode);
    if (q.phase === 'registry-migrate-agent-v1') { insist(sha.safeParse(d.consumer_disposition_digest).success, 'CONSUMER_DISPOSITION_REQUIRED'); consumerDispositions.set(q.operation_id, d.consumer_disposition_digest!); }
    const pins = ['environment', 'source_commit', 'spec_ref', 'spec_digest', 'audience_authority_ref',
      'audience_authority_digest', 'bundle_digest', 'runtime_digest', 'runtime_preimage_receipt_ref',
      'runtime_preimage_receipt_digest', 'operator_ref'] as const;
    insist(pins.every(k => d[k] === q[k]) && d.environment === o.environment && d.executor_uid === c.uid &&
      d.executor_gid === c.gid && d.candidate_validated && d.native_product_disabled, 'DEPENDENCY_PIN_MISMATCH');
    if(q.phase==='supply' && o.custody) { const phaseA=await o.custody.readChild('registry-migrate-agent-v1'); const terminal=await readPilotTerminal(o.custody,'registry-migrate-agent-v1');
      insist(q.registry_receipt_ref===join(phaseA.operationDirectory,'result.json') && q.registry_receipt_digest===digest(terminal) && terminal.audience_after?.version===2,'MIGRATION_RECEIPT_REQUIRED'); }
    if (q.phase === 'supply') insist(d.original_transport_verified && d.loaded_candidate_db_aligned &&
      ['connector_config_receipt_ref', 'connector_config_receipt_digest', 'connector_subject', 'registry_receipt_ref', 'registry_receipt_digest']
        .every(k => d[k as keyof Dependencies] === q[k as keyof Request]), 'PHASE_B_ALIGNMENT_REQUIRED');
    else insist(d.stopped_original_service && d.stop_serving_receipt_ref === q.stop_serving_receipt_ref &&
      d.stop_serving_receipt_digest === q.stop_serving_receipt_digest, 'STOP_SERVING_RECEIPT_REQUIRED');
  }
  async function authorize(q: Request, action: 'apply' | 'recover-delivery', pd: string) {
    let m = await o.mandate(q, action, pd);
    if (o.custody) {
      insist(PILOT_CAPABILITIES.includes(q.phase as PilotCapability), 'PARENT_CAPABILITY_REFUSED');
      const record = await o.custody.readChild(q.phase as PilotCapability), child = record.child;
      insist(q.parent_delegation_id === o.custody.parent.delegation_id && q.parent_delegation_digest === o.custody.parentDigest &&
        q.approval_ref === join(record.operationDirectory, 'mandate.json') && q.approval_digest === record.childDigest && child.operation_id === q.operation_id &&
        child.plan_digest === pd && child.approval_nonce === q.approval_nonce, 'CHILD_REQUEST_MISMATCH');
      m = { issuer: o.authorityIssuer, actor: child.actor_ref, environment: child.environment, operation_id: child.operation_id,
        approval_ref: q.approval_ref, approval_digest: record.childDigest, approval_nonce: child.approval_nonce, plan_digest: child.plan_digest,
        action, expires_at: child.expires_at, attempts_max: 1 };
    }
    insist(q.approval_digest && m && m.issuer === o.authorityIssuer && m.actor === q.operator_ref && m.environment === q.environment &&
      m.operation_id === q.operation_id && m.approval_ref === q.approval_ref && m.approval_digest === q.approval_digest &&
      m.approval_nonce === q.approval_nonce && m.plan_digest === pd && m.action === action && m.attempts_max === 1 &&
      Date.parse(m.expires_at) > Date.now() && Date.parse(q.expires_at) > Date.now() && Date.parse(q.created_at) <= Date.now() &&
      Date.parse(q.expires_at) > Date.parse(q.created_at) && (action !== 'recover-delivery' ||
        (typeof m.recovery_nonce === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(m.recovery_nonce) && m.recovery_nonce !== q.approval_nonce)), 'MANDATE_REFUSED');
    return m;
  }
  async function locked<T>(q: Request, writing: boolean, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return db.$transaction(async tx => {
      await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '${Math.max(1, Math.min(o.lockTimeoutMs ?? 1000, 10000))}ms'`);
      // DO NOT move advisory SELECT above these locks: its SELECT establishes a snapshot.
      for (const table of ['auth_audiences', 'auth_security_audits', 'grant_change_audits', 'machine_access_grants', 'machine_clients', 'machine_principals']) {
        const writeTable = q.phase === 'supply' ? !['auth_audiences', 'auth_security_audits'].includes(table) : ['auth_audiences', 'auth_security_audits'].includes(table);
        await tx.$executeRawUnsafe(`LOCK TABLE "${table}" IN ${writing && writeTable ? 'SHARE ROW EXCLUSIVE' : 'SHARE'} MODE`);
      }
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(813947203)');
      await fault('locks-held-before-snapshot');
      return fn(tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 1500, timeout: 20000 });
  }
  async function snapshot(tx: Tx): Promise<Snapshot> {
    // No parallel statements on a single connection, and no reads before the six locks.
    return { audiences: await tx.authAudience.findMany(), principals: await tx.machinePrincipal.findMany(),
      clients: await tx.machineClient.findMany(), grants: await tx.machineAccessGrant.findMany(),
      security: await tx.authSecurityAudit.findMany(), audits: await tx.grantChangeAudit.findMany() };
  }
  function target(s: Snapshot, q: Request) {
    const p = s.principals.filter(v => v.externalRef === FIXED.externalRef);
    const cli = s.clients.filter(v => v.externalRef === FIXED.externalRef || p.some(p => p.id === v.machinePrincipalId));
    const grants = s.grants.filter(v => cli.some(c => c.id === v.machineClientId));
    const audits = s.audits.filter(v => v.migrationId === migration(q) || cli.some(c => c.clientId === v.clientId));
    const a = s.audiences.find(v => v.audienceId === FIXED.resource);
    const security = s.security.filter(v => (v.details as Json)?.operation_id === q.operation_id);
    return { p, cli, grants, audits, a, security };
  }
  function nonTarget(s: Snapshot, q: Request): string {
    const t = target(s, q); const sorted = (rows: any[]) => rows.map(canonical).sort();
    return digest({ audiences: sorted(s.audiences.filter(v => q.phase === 'supply' || v.audienceId !== FIXED.resource)),
      principals: sorted(s.principals.filter(v => q.phase !== 'supply' || !t.p.includes(v))), clients: sorted(s.clients.filter(v => q.phase !== 'supply' || !t.cli.includes(v))),
      grants: sorted(s.grants.filter(v => q.phase !== 'supply' || !t.grants.includes(v))), audits: sorted(s.audits.filter(v => q.phase !== 'supply' || !t.audits.includes(v))),
      security: sorted(s.security.filter(v => !t.security.includes(v))) });
  }
  function safeState(s: Snapshot, q: Request, fs: Json): Json {
    const t = target(s, q); return { filesystem_preimage: { parent_identity: fs.parent_identity, escrow_identity: fs.escrow_identity,
      ancestor_digest: digest(fs.ancestor_identities) }, audience: tagged(t.a), principal: t.p.map(tagged), client: t.cli.map(publicClient),
      grant: t.grants.map(tagged), audit: (q.phase === 'supply' ? t.audits : t.security).map(v => ({ state: 'present', id: v.id,
        kind: q.phase === 'supply' ? 'grant_change_audit' : 'auth_security_audit', timestamp: v.timestamp })),
      destination: q.phase === 'supply' ? fs.destination : { state: 'not_applicable' }, non_target_digest: nonTarget(s, q) };
  }
  function exactAudit(q: Request, details: Json, before: Json, after: Json): boolean {
    const expected = auditDetails(q, { plan_digest: details?.plan_digest }, before, after, details?.non_target_digest_before);
    if (q.phase === 'registry-migrate-agent-v1') Object.assign(expected, { historical_audit_candidate_id: 'deedbadf-3968-427b-871f-2e418777877d', consumer_disposition_digest: consumerDispositions.get(q.operation_id) });
    if (q.phase === 'registry-disable-migrated') expected.reason = 'bounded-mcp-migrated-forward-disable-v2';
    return sha.safeParse(details?.plan_digest).success && sha.safeParse(details?.non_target_digest_before).success && equal(details, expected);
  }
  function classify(s: Snapshot, q: Request): 'ABSENT_APPLY' | 'DISABLE_APPLY' | 'EXACT_AGENT1_MIGRATE' | 'EXACT_RERUN_NOOP' | 'REFUSED' {
    const t = target(s, q);
    if (q.phase !== 'supply') {
      if (q.phase === 'registry-migrate-agent-v1' || q.phase === 'registry-disable-migrated') {
        const disable = q.phase === 'registry-disable-migrated';
        if (!t.security.length && (disable ? migratedExact(t.a) : equal(t.a, LEGACY_AUDIENCE))) {
          if (disable && !s.security.some(a => a.eventType === 'audience.mcp_conversation_profile_migrated' &&
            a.result === 'success' && equal((a.details as Json)?.after, tagged(t.a)) &&
            (a.details as Json)?.parent_delegation_id === q.parent_delegation_id)) return 'REFUSED';
          return disable ? 'DISABLE_APPLY' : 'EXACT_AGENT1_MIGRATE';
        }
        if (!migratedExact(t.a, disable) || t.security.length !== 1) return 'REFUSED';
        const a = t.security[0], d = a.details as Json;
        return a.eventType === (disable ? 'audience.registry_disabled' : 'audience.mcp_conversation_profile_migrated') &&
          a.result === 'success' && (disable ? migratedExact(d?.before && Object.fromEntries(Object.entries(d.before).filter(([k]) => k !== 'state'))) : equal(d?.before, { state: 'present', ...LEGACY_AUDIENCE })) &&
          exactAudit(q, d, d.before, tagged(t.a)) && d.non_target_digest_before === nonTarget(s, q) ? 'EXACT_RERUN_NOOP' : 'REFUSED';
      }
      const disabled = q.phase === 'registry-disable';
      if (!disabled && !t.a && !t.security.length) return 'ABSENT_APPLY';
      if (disabled && audienceExact(t.a, false) && !t.security.length) return 'DISABLE_APPLY';
      if (!audienceExact(t.a, disabled) || t.security.length !== 1) return 'REFUSED';
      const au = t.security[0], d = au.details as Json;
      const before = disabled ? d?.before : { state: 'absent' };
      const beforeRow = before && { ...before }; if (beforeRow) delete beforeRow.state;
      if (disabled && (before?.state !== 'present' || !audienceExact(beforeRow, false))) return 'REFUSED';
      return au.eventType === (disabled ? 'audience.registry_disabled' : 'audience.registry_reconciled') && au.result === 'success' &&
        exactAudit(q, d, before, tagged(t.a)) && d.non_target_digest_before === nonTarget(s, q) ? 'EXACT_RERUN_NOOP' : 'REFUSED';
    }
    if (o.custody && !migratedExact(t.a)) return 'REFUSED';
    if (!audienceExact(t.a, false) && !(migratedExact(t.a) && s.security.some(a =>
      a.eventType === 'audience.mcp_conversation_profile_migrated' && a.result === 'success' &&
      (a.details as Json)?.parent_delegation_id === q.parent_delegation_id && equal((a.details as Json)?.after, tagged(t.a))))) return 'REFUSED';
    if (!t.p.length && !t.cli.length && !t.grants.length && !t.audits.length) return 'ABSENT_APPLY';
    if (t.p.length !== 1 || t.cli.length !== 1 || t.grants.length !== 1 || t.audits.length !== 1) return 'REFUSED';
    const [p] = t.p, [cl] = t.cli, [g] = t.grants, [a] = t.audits;
    if (p.principalType !== 'service' || p.status !== 'active' || p.agentId !== null || p.ownerUserId !== null || p.disabledAt !== null ||
      p.displayName !== FIXED.displayName || cl.status !== 'active' || cl.externalRef !== FIXED.externalRef || cl.machinePrincipalId !== p.id ||
      cl.revokedAt !== null || cl.rotatedAt !== null || cl.allowedResources.length || cl.allowedScopes.length ||
      !/^mc_[A-Za-z0-9_-]{24}$/.test(cl.clientId) || p.id === q.connector_subject || cl.id === q.connector_subject || p.id === cl.id ||
      p.id === PRODUCT.target_principal_id || cl.id === PRODUCT.target_principal_id ||
      g.audienceId !== FIXED.resource || g.version !== 1 || !equal(g.scopes, [FIXED.scope]) || a.migrationId !== migration(q) ||
      a.sourceGitCommit !== q.source_commit || a.operatorId !== q.operator_ref || a.approvalRef !== q.approval_ref ||
      a.clientId !== cl.clientId || a.changeType !== 'create' || a.expectedGrantVersion !== null || a.resultingGrantVersion !== 1 ||
      a.reason !== 'bounded-mcp-conversation-pilot-v1' || !equal(a.beforeValue, { state: 'absent' })) return 'REFUSED';
    const after = { state: 'present', principal: tagged(p), client: publicClient(cl), grant: tagged(g) };
    const d = a.afterValue as Json;
    return exactAudit(q, d, { state: 'absent' }, after) && p.requestDigest === d.plan_digest &&
      d.non_target_digest_before === nonTarget(s, q) ? 'EXACT_RERUN_NOOP' : 'REFUSED';
  }
  function matches(q: Request, s: Snapshot, credential: Json | undefined): boolean {
    const t = target(s, q); if (q.phase !== 'supply' || t.cli.length !== 1 || !credential) return false;
    try { return credential.connector_subject === q.connector_subject && credential.client_id === t.cli[0].clientId &&
      verifyClientSecret(credential.client_secret, t.cli[0].secretHash); } catch { return false; }
  }
  function activeFences(fs: Json) { return (fs.fences as Json[][]).filter(v => !['COMMITTED', 'RECOVERED'].includes(v.at(-1)?.stage)); }
  function makePlan(q: Request, s: Snapshot, fs: Json): Json {
    const state = safeState(s, q, fs), classification = q.phase === 'supply' && fs.destination.state === 'unsafe' ? 'REFUSED' : classify(s, q);
    return { schema_version: 2, phase: q.phase, result: 'PLAN', request: unsigned(q), plan_digest: planHash(q, state, classification),
      prestate_digest: digest(state), prestate: state, classification,
      intended_effect: q.phase === 'supply' ? { principal: 1, client: 1, grant: 1, audit: 1, audience: 0 } :
        { principal: 0, client: 0, grant: 0, audit: 1, audience: 1, credential: 0 },
      approval_nonce: q.approval_nonce, observed_at: new Date().toISOString(), expires_at: q.expires_at,
      native_product_disabled: true, live_credential_acceptance: 'NOT_RUN', filesystem_observation: 'separate_non_atomic' };
  }
  function validatePlan(p: Json | undefined, q: Request): asserts p is Json {
    insist(p && keysEqual(p, ['schema_version', 'phase', 'result', 'request', 'plan_digest', 'prestate_digest', 'prestate', 'classification',
      'intended_effect', 'approval_nonce', 'observed_at', 'expires_at', 'native_product_disabled', 'live_credential_acceptance', 'filesystem_observation']) &&
      equal(p.request, unsigned(q)) && p.result === 'PLAN' && p.schema_version === 2 && p.phase === q.phase && p.approval_nonce === q.approval_nonce &&
      p.prestate_digest === digest(p.prestate) && p.plan_digest === planHash(q, p.prestate, p.classification), 'PLAN_INVALID');
    insist(p.expires_at === q.expires_at && Date.parse(p.expires_at) > Date.now(), 'PLAN_EXPIRED');
  }
  function fenceRecord(q: Request, p: Json, stage: string): Json { return { stage, operation_id: q.operation_id,
    approval_nonce: q.approval_nonce, plan_digest: p.plan_digest, operator_ref: q.operator_ref,
    request_digest: digest(q), external_ref: FIXED.externalRef, prestate_digest: p.prestate_digest,
    phase: q.phase, observed_at: new Date().toISOString() }; }
  function append(q: Request, p: Json, stage: string, extra: Json = {}) { osCall(c, q, 'append', { record: { ...fenceRecord(q, p, stage), ...extra }, fault: osFault() }); }
  function pinnedCredential(q: Request, fs: Json, escrow: boolean): CredentialObservation {
    const rows = (fs.fences as Json[][]).find(v => v[0]?.operation_id === q.operation_id);
    let expected = rows?.filter(v => v.stage === (escrow ? 'ESCROW_DURABLE' : 'DESTINATION_DURABLE') || (!escrow && v.stage === 'RECOVERED')).at(-1)?.file_identity;
    if (!escrow) { const recovery = (fs.recoveries ?? []).find((v: Json[]) => v[0]?.original_supply_operation_id === q.operation_id && v[0]?.original_supply_request_digest === digest(q) && v.at(-1)?.stage === 'RECOVERED'); if (recovery) expected = recovery.at(-1).file_identity; }
    const observed = privateCredential(c, q, escrow, osFault());
    if (observed.kind !== 'present') return observed;
    if (!expected) return { kind: 'unavailable' };
    return equal(expected, observed.credential.__fileIdentity) ? observed : { kind: 'invalid' };
  }
  function receipt(q: Request, s: Snapshot, p: Json, noop: boolean, fs: Json): Json {
    const t = target(s, q), state = safeState(s, q, fs), now = new Date().toISOString();
    if (q.phase !== 'supply') {
      const a = t.security[0], d = a.details as Json;
      return { ...q, result: noop ? 'EXACT_RERUN_NOOP' : 'COMMITTED',
        plan_digest: d.plan_digest, prestate_digest: p.prestate_digest, poststate_digest: digest(state),
        audience_before: d.before, audience_after: tagged(t.a), audit_id: a.id,
        non_target_digest_before: d.non_target_digest_before, non_target_digest_after: nonTarget(s, q),
        effect_counts: { audience: noop ? 0 : 1, audit: noop ? 0 : 1, principal: 0, client: 0, grant: 0, credential: 0 },
        committed_at: a.timestamp.toISOString(), verified_at: now, runtime_alignment: 'stopped_pending_load' };
    }
    const [principal] = t.p, [client] = t.cli, [audit] = t.audits, d = audit.afterValue as Json;
    return { schema_version: 2, parent_delegation_id: q.parent_delegation_id, parent_delegation_digest: q.parent_delegation_digest, phase: 'supply', result: noop ? 'EXACT_RERUN_NOOP' : 'COMMITTED', operation_id: q.operation_id,
      environment: q.environment, operator_ref: q.operator_ref, approval_ref: q.approval_ref, approval_digest: q.approval_digest,
      approval_nonce: q.approval_nonce, source_commit: q.source_commit, spec_ref: q.spec_ref, spec_digest: q.spec_digest,
      plan_digest: d.plan_digest, prestate_digest: p.prestate_digest, poststate_digest: digest(state), audit_id: audit.id,
      principal_id: principal.id, principal_type: 'service', principal_external_ref: principal.externalRef,
      client_row_id: client.id, client_id: client.clientId, client_external_ref: client.externalRef, resource: FIXED.resource,
      scope: FIXED.scope, grant_version: 1, connector_subject: q.connector_subject,
      connector_config_receipt_ref: q.connector_config_receipt_ref, connector_config_receipt_digest: q.connector_config_receipt_digest,
      communication_scope_id: FIXED.communicationScope, product_context: PRODUCT,
      credential_delivery: { path: c.destination, uid: c.uid, gid: c.gid, mode: '0600', regular: true, nonsymlink: true, secret_matches_verifier: true },
      effect_counts: { principal: noop ? 0 : 1, client: noop ? 0 : 1, grant: noop ? 0 : 1, audit: noop ? 0 : 1 },
      non_target_digest_before: d.non_target_digest_before, non_target_digest_after: nonTarget(s, q),
      committed_at: audit.timestamp.toISOString(), verified_at: now };
  }
  async function observe(q: Request, action: Action): Promise<Json> {
    if(action==='plan') await dependencies(q);
    else if(q.phase==='registry-migrate-agent-v1') await dependencies(q,'recorded');
    const fs = fileState(c, q);
    return locked(q, false, async tx => {
      const s = await snapshot(tx), p = makePlan(q, s, fs), classification = classify(s, q);
      if (action === 'plan') return p;
      if (classification === 'EXACT_RERUN_NOOP') {
        if (q.phase !== 'supply') return receipt(q, s, p, true, fs);
        const destination = pinnedCredential(q, fs, false);
        if (matches(q, s, credentialValue(destination))) return receipt(q, s, p, true, fs);
        const escrow = pinnedCredential(q, fs, true);
        if (destination.kind === 'unavailable' || escrow.kind === 'unavailable')
          return failure(q, 'reconcile', 'PRIVATE_COPY_UNAVAILABLE', true, 'OUTCOME_UNKNOWN');
        const recoverable = matches(q, s, credentialValue(escrow));
        return { ...failure(q, 'reconcile', recoverable ? 'COMMITTED_DELIVERY_INCOMPLETE' : 'SECRET_LOST', true,
          recoverable ? 'OUTCOME_UNKNOWN' : 'SECRET_LOST'), residual_coordinates: { state: recoverable ? 'committed_delivery_incomplete' : 'secret_lost',
            operation_id: q.operation_id, audit_id: target(s, q).audits[0].id } };
      }
      const fence = (fs.fences as Json[][]).find(v => v[0]?.operation_id === q.operation_id);
      if (action === 'reconcile' && classification === 'ABSENT_APPLY' && fence && fence[0].approval_nonce === q.approval_nonce &&
        fence[0].request_digest === digest(q)) {
        // Taking all six conflicting table locks proves the old DB transaction has ended.
        return { ...failure(q, 'reconcile', 'PROVEN_NOT_COMMITTED', true, 'OUTCOME_UNKNOWN'),
          residual_coordinates: { state: 'proven_not_committed', operation_id: q.operation_id } };
      }
      return failure(q, action, 'STATE_CONFLICT', !!fence, fence ? 'OUTCOME_UNKNOWN' : 'REFUSED');
    });
  }
  async function mutate(q: Request, action: 'apply' | 'recover-delivery', supplied?: Json): Promise<Json> {
    await dependencies(q); validatePlan(supplied, q); let lease: Awaited<ReturnType<typeof acquireOsLock>> | undefined; let parentLease: Awaited<ReturnType<PilotCustody['admit']>> | undefined; let fenced = false, stage = 'admission', commitRequested = false;
    try {
      // Read-only exact NOOP may not create even an operation lock.
      const observed = await observe(q, 'verify');
      if (action === 'apply' && observed.result === 'EXACT_RERUN_NOOP') return observed;
      const authority = await authorize(q, action, supplied.plan_digest);
      if (o.custody) parentLease = await o.custody.admit(q.phase as PilotCapability, supplied.plan_digest);
      if (action === 'recover-delivery') {
        insist(q.phase === 'supply' && observed.residual_coordinates?.state === 'committed_delivery_incomplete', 'RECOVERY_STATE_REFUSED');
        // Recovery mandate is new; its approval nonce is independent of original operation nonce.
        // The request remains original for immutable DB audit matching; verifier binds new recovery authority out-of-band.
        fenced = true; lease = await acquireOsLock(c, q); lease.assertHeld(); stage = 'recover-delivery';
        await fault('RECOVERY_LOCK_ACQUIRED'); lease.assertHeld();
        const fs = fileState(c, q); insist(fs.destination.state === 'absent', 'RECOVERY_DESTINATION_NOT_ABSENT');
        await locked(q, false, async tx => { const s = await snapshot(tx); insist(classify(s, q) === 'EXACT_RERUN_NOOP' &&
          matches(q, s, credentialValue(pinnedCredential(q, fs, true))), 'ORIGINAL_ESCROW_REQUIRED'); });
        osCall(c, q, 'recovery-claim', { nonce: authority.recovery_nonce, record: { ...fenceRecord(q, supplied, 'RECOVERY_STARTED'), recovery_nonce: authority.recovery_nonce, approval_digest: authority.approval_digest }, fault: osFault() });
        append(q, supplied, 'RECOVERY_STARTED', { recovery_nonce: authority.recovery_nonce, approval_digest: authority.approval_digest });
        lease.assertHeld(); const delivered = osCall(c, q, 'install', { expected_parent: fs.parent_identity, expected_escrow: fs.escrow_identity, fault: osFault() }).value;
        append(q, supplied, 'RECOVERED', { file_identity: delivered, recovery_nonce: authority.recovery_nonce });
        const after = await observe(q, 'verify'); insist(after.result === 'EXACT_RERUN_NOOP', 'RECOVERY_VERIFY_FAILED');
        return { ...after, result: 'EXACT_RERUN_NOOP' };
      }
      if (o.custody) { const retained = retainedWindows.get(o.custody.parent.delegation_id); insist(retained, 'ORIGINAL_WINDOW_OWNER_REQUIRED');
        lease = { ...retained.operation, release: async () => {} }; } else lease = await acquireOsLock(c, q); lease.assertHeld();
      let committedSnapshot: Snapshot | undefined;
      await locked(q, true, async tx => {
        parentLease?.assertHeld(); lease!.assertHeld(); stage = 'locked-prestate';
        await dependencies(q); const fs = fileState(c, q), s = await snapshot(tx), p = makePlan(q, s, fs);
        insist(p.plan_digest === supplied.plan_digest && p.prestate_digest === supplied.prestate_digest, 'STALE_PLAN');
        insist(['ABSENT_APPLY', 'DISABLE_APPLY', 'EXACT_AGENT1_MIGRATE'].includes(p.classification), 'STATE_CONFLICT');
        insist(!activeFences(fs).length, 'UNRESOLVED_ATTEMPT');
        if(o.custody) insist(!(fs.fences as Json[][]).some(rows=>rows[0]?.phase===q.phase), 'PILOT_CAPABILITY_SPENT');
        if (q.phase === 'supply') insist(fs.destination.state === 'absent', 'DESTINATION_NOT_ABSENT');
        stage = 'claim'; fenced = true; osCall(c, q, 'claim', { nonce: q.approval_nonce, record: fenceRecord(q, p, 'ATTEMPT_STARTED'), fault: osFault() });
        await fault('ATTEMPT_STARTED'); const beforeDigest = nonTarget(s, q);
        let audit: any;
        if (q.phase !== 'supply') {
          stage = 'registry-write'; const before = tagged(target(s, q).a);
          let row: any;
          if (q.phase === 'registry') row = await tx.authAudience.create({ data: { ...AUDIENCE, acceptedPrincipalTypes: ['service'], registeredScopes: [FIXED.scope] } });
          else {
            const prior = target(s, q).a;
            const where = { ...prior, acceptedPrincipalTypes: { equals: prior.acceptedPrincipalTypes }, registeredScopes: { equals: prior.registeredScopes } };
            // Full projection CAS includes both timestamps and every existing column.
            const isMigration = q.phase === 'registry-migrate-agent-v1';
            const clock = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
            const count = await tx.authAudience.updateMany({ where, data: isMigration ?
              { acceptedPrincipalTypes: ['service'], version: 2, updatedAt: clock[0].now } : { status: 'disabled', freezeReady: false, version: prior.version + 1, updatedAt: clock[0].now } });
            insist(count.count === 1, 'AUDIENCE_CAS_CONFLICT');
            row = await tx.authAudience.findUniqueOrThrow({ where: { audienceId: FIXED.resource } });
            insist(equal(row, { ...prior, ...(isMigration ? { acceptedPrincipalTypes: ['service'], version: 2 } :
              { status: 'disabled', freezeReady: false, version: prior.version + 1 }), updatedAt: row.updatedAt }), 'AUDIENCE_RESELECT_MISMATCH');
          }
          await fault('registry-row');
          const details = auditDetails(q, p, before, tagged(row), beforeDigest);
          if (q.phase === 'registry-migrate-agent-v1') Object.assign(details, { historical_audit_candidate_id: 'deedbadf-3968-427b-871f-2e418777877d', consumer_disposition_digest: consumerDispositions.get(q.operation_id) });
          if (q.phase === 'registry-disable-migrated') details.reason = 'bounded-mcp-migrated-forward-disable-v2';
          audit = await tx.authSecurityAudit.create({ data: { eventType: q.phase === 'registry' ? 'audience.registry_reconciled' : q.phase === 'registry-migrate-agent-v1' ? 'audience.mcp_conversation_profile_migrated' : 'audience.registry_disabled',
            result: 'success', requestCorrelationId: q.operation_id, details } });
          await fault('audit');
        } else {
          stage = 'secret-generation'; await fault('before-secret-generation');
          const freshFs = fileState(c, q);
          insist(equal(freshFs.parent_identity, fs.parent_identity) && equal(freshFs.escrow_identity, fs.escrow_identity) &&
            equal(freshFs.ancestor_identities, fs.ancestor_identities) && freshFs.destination.state === 'absent', 'FILESYSTEM_PREIMAGE_CHANGED');
          lease!.assertHeld(); const secret = generateClientSecret(); await fault('SECRET_GENERATED'); const verifier = hashClientSecret(secret);
          const clientId = 'mc_' + randomBytes(18).toString('base64url');
          stage = 'escrow'; const escrowIdentity = osCall(c, q, 'escrow', { private: JSON.stringify({ connector_subject: q.connector_subject, client_id: clientId, client_secret: secret }),
            expected_parent: fs.parent_identity, expected_escrow: fs.escrow_identity, fault: osFault() }).value;
          append(q, p, 'ESCROW_DURABLE', { file_identity: escrowIdentity }); await fault('ESCROW_DURABLE');
          stage = 'principal'; const principal = await tx.machinePrincipal.create({ data: { principalType: 'service', displayName: FIXED.displayName,
            externalRef: FIXED.externalRef, status: 'active', requestDigest: p.plan_digest } }); await fault('principal');
          stage = 'client'; const client = await tx.machineClient.create({ data: { clientId, machinePrincipalId: principal.id, secretHash: verifier,
            externalRef: FIXED.externalRef, status: 'active', allowedResources: [], allowedScopes: [] } }); await fault('client');
          insist(principal.id !== q.connector_subject && client.id !== q.connector_subject && principal.id !== client.id &&
            principal.id !== PRODUCT.target_principal_id && client.id !== PRODUCT.target_principal_id, 'GENERATED_ID_COLLISION');
          stage = 'grant'; const grant = await tx.machineAccessGrant.create({ data: { machineClientId: client.id, audienceId: FIXED.resource, scopes: [FIXED.scope], version: 1 } }); await fault('grant');
          const after = { state: 'present', principal: tagged(principal), client: publicClient(client), grant: tagged(grant) };
          stage = 'audit'; audit = await tx.grantChangeAudit.create({ data: { migrationId: migration(q), sourceGitCommit: q.source_commit,
            operatorId: q.operator_ref, approvalRef: q.approval_ref, reason: 'bounded-mcp-conversation-pilot-v1', clientId,
            changeType: 'create', expectedGrantVersion: null, resultingGrantVersion: 1, beforeValue: { state: 'absent' },
            afterValue: auditDetails(q, p, { state: 'absent' }, after, beforeDigest) } }); await fault('audit');
          stage = 'destination'; const destinationIdentity = osCall(c, q, 'install', { expected_parent: fs.parent_identity, expected_escrow: fs.escrow_identity, fault: osFault() }).value;
          insist(matches(q, await snapshot(tx), credentialValue(privateCredential(c, q, false, osFault()))), 'DELIVERY_VERIFY_FAILED');
          append(q, p, 'DESTINATION_DURABLE', { file_identity: destinationIdentity }); await fault('DESTINATION_DURABLE');
        }
        lease!.assertHeld(); committedSnapshot = await snapshot(tx);
        insist(nonTarget(committedSnapshot, q) === beforeDigest && classify(committedSnapshot, q) === 'EXACT_RERUN_NOOP', 'PRECOMMIT_INVARIANT');
        stage = 'COMMIT_REQUESTED'; append(q, p, 'COMMIT_REQUESTED'); commitRequested = true; await fault('COMMIT_REQUESTED'); lease!.assertHeld();
      });
      stage = 'COMMIT_RESULT'; await fault('COMMIT_RESULT');
      const post = await locked(q, false, async tx => { const s = await snapshot(tx); insist(classify(s, q) === 'EXACT_RERUN_NOOP', 'READBACK_MISMATCH');
        if (q.phase === 'supply') insist(matches(q, s, credentialValue(privateCredential(c, q, false, osFault()))), 'READBACK_DELIVERY_MISMATCH'); return s; });
      append(q, supplied, 'COMMITTED');
      const terminal = validatePublicOutput(receipt(q, post, supplied, false, fileState(c, q)));
      if (o.custody) { custodyCall(q.parent_delegation_id,'terminal-write',{capability:q.phase,record:canonical(terminal)}); await o.custody.appendStage(q.phase as PilotCapability, 'COMMITTED', digest(terminal)); }
      return terminal;
    } catch (e) {
      const category = e instanceof Refusal ? e.category : 'DB_OR_PROCESS_FAILURE';
      // No unproven rollback or absence claim. Escrow/final material and tombstones persist.
      return failure(q, stage, category, fenced, fenced || commitRequested ? 'OUTCOME_UNKNOWN' : 'REFUSED');
    } finally { if (lease) await lease.release(); if (parentLease) await parentLease.release(); }
  }
  async function recoverV2(raw: string, action: Action, plan?: Json): Promise<Json> {
    const r = parseRecoveryRequest(raw);
    insist(['plan','recover-delivery','verify','reconcile'].includes(action), 'INVALID_RECOVERY_ACTION');
    let original: { request: Request; receipt: Json };
    if (o.custody) {
      const supply = await o.custody.readChild('supply');
      original = { request: parseRequest(JSON.stringify({ ...supply.plan.request, approval_digest: supply.childDigest })),
        receipt: custodyCall(o.custody.parent.delegation_id, 'reconciliation-read', { capability: 'supply' }) };
    } else { insist(o.originalSupply, 'ORIGINAL_SUPPLY_CHAIN_REQUIRED'); original = await o.originalSupply(); }
    const q = original.request;
    insist(q.phase === 'supply' && q.operation_id === r.original_supply_operation_id && q.operation_id !== r.operation_id &&
      q.parent_delegation_id === r.parent_delegation_id && q.parent_delegation_digest === r.parent_delegation_digest &&
      q.source_commit === r.source_commit && q.spec_ref === r.spec_ref && q.spec_digest === r.spec_digest && q.operator_ref === r.operator_ref &&
      digest(q) === r.original_supply_request_digest && digest(original.receipt) === r.original_supply_receipt_digest &&
      original.receipt.error_class === 'COMMITTED_DELIVERY_INCOMPLETE', 'ORIGINAL_SUPPLY_CHAIN_INVALID');
    if(action==='plan' || action==='recover-delivery') await dependencies({...q,operation_id:r.operation_id,created_at:r.created_at,expires_at:r.expires_at});
    const fs = fileState(c, q);
    if(['verify','reconcile'].includes(action) && fs.destination.state==='present'){
      const rows=(fs.recoveries as Json[][]).find(rows=>rows[0]?.operation_id===r.operation_id);
      insist(rows && rows[0].original_supply_operation_id===q.operation_id && rows[0].original_supply_request_digest===digest(q) && rows[0].approval_nonce===r.approval_nonce &&
        rows[0].approval_digest===r.approval_digest && rows.at(-1)?.stage==='RECOVERED','RECOVERY_LEDGER_UNPROVEN');
      if(o.custody){const child=await o.custody.readChild('recover-delivery');insist(child.childDigest===r.approval_digest && equal(r,{...child.plan.request,approval_digest:child.childDigest}),'RECOVERY_MANDATE_INVALID');}
      const current=await locked(q,false,async tx=>{const s=await snapshot(tx);insist(classify(s,q)==='EXACT_RERUN_NOOP' && matches(q,s,credentialValue(pinnedCredential(q,fs,false))),'RECOVERY_VERIFY_FAILED');return target(s,q);});
      return {schema_version:2,phase:'recover-delivery',result:'RECOVERED',parent_delegation_id:r.parent_delegation_id,parent_delegation_digest:r.parent_delegation_digest,
        operation_id:r.operation_id,original_supply_operation_id:q.operation_id,approval_digest:r.approval_digest,approval_nonce:r.approval_nonce,original_audit_id:current.audits[0].id,
        principal_id:current.p[0].id,client_row_id:current.cli[0].id,client_id:current.cli[0].clientId,destination_identity:fs.destination,secret_matches_verifier:true,effect_counts:{database:0,secret:0},verified_at:new Date().toISOString()};
    }
    const current = await locked(q,false,async tx=>{const s=await snapshot(tx);insist(classify(s,q)==='EXACT_RERUN_NOOP' && matches(q,s,credentialValue(pinnedCredential(q,fs,true))), 'ORIGINAL_ESCROW_REQUIRED');return {residual_coordinates:{state:'committed_delivery_incomplete',audit_id:target(s,q).audits[0].id}};});
    insist(current.residual_coordinates?.state === 'committed_delivery_incomplete' &&
      current.residual_coordinates.audit_id === original.receipt.residual_coordinates?.audit_id && fs.destination.state === 'absent', 'RECOVERY_STATE_REFUSED');
    const escrow = pinnedCredential(q, fs, true); insist(escrow.kind === 'present', 'ORIGINAL_ESCROW_REQUIRED');
    const prestate = { original_audit_id: current.residual_coordinates.audit_id, original_supply_request_digest: digest(q),
      original_supply_receipt_digest: digest(original.receipt), escrow_identity: escrow.credential.__fileIdentity,
      secret_matches_verifier: true, destination: fs.destination };
    const { approval_digest, ...unsignedRecovery } = r;
    const pd = digest({ request_without_approval_digest: unsignedRecovery, prestate, classification: 'COMMITTED_DELIVERY_INCOMPLETE' });
    if (action === 'plan' || action === 'verify' || action === 'reconcile') return { schema_version: 2, phase: 'recover-delivery', result: 'PLAN',
      request: unsignedRecovery, plan_digest: pd, prestate, classification: 'COMMITTED_DELIVERY_INCOMPLETE' };
    insist(plan && plan.plan_digest === pd && equal(plan.prestate, prestate) && equal(plan.request, unsignedRecovery) &&
      Date.now() < Date.parse(r.expires_at) && r.approval_nonce !== q.approval_nonce && approval_digest, 'RECOVERY_PLAN_INVALID');
    let recoveryStarted=false;
    let control: Awaited<ReturnType<PilotCustody['admit']>> | undefined;
    let lease: Awaited<ReturnType<typeof acquireOsLock>> | undefined;
    try {
      if (o.custody) {
        const recovery = await o.custody.readChild('recover-delivery');
        insist(recovery.child.operation_id === r.operation_id && recovery.child.plan_digest === pd && recovery.childDigest === approval_digest &&
          recovery.child.approval_nonce === r.approval_nonce && r.approval_ref === join(recovery.operationDirectory,'mandate.json'), 'RECOVERY_MANDATE_INVALID');
        control = await o.custody.admit('recover-delivery', pd);
        const window = retainedWindows.get(r.parent_delegation_id); insist(window, 'ORIGINAL_WINDOW_OWNER_REQUIRED');
        lease = { ...window.operation, release: async () => {} };
      } else {
        const authority = await o.mandate({ ...q, operation_id:r.operation_id, approval_nonce:r.approval_nonce, approval_digest:r.approval_digest, created_at:r.created_at, expires_at:r.expires_at } as Request, 'recover-delivery', pd);
        insist(authority && authority.operation_id === r.operation_id && authority.approval_nonce === r.approval_nonce && authority.approval_digest === approval_digest &&
          authority.plan_digest === pd && Date.now() < Date.parse(authority.expires_at), 'RECOVERY_MANDATE_INVALID');
        lease = await acquireOsLock(c,q);
      }
      lease.assertHeld(); control?.assertHeld();
      const now = fileState(c,q); insist(now.destination.state === 'absent' && equal(now.parent_identity,fs.parent_identity) && equal(now.escrow_identity,fs.escrow_identity), 'RECOVERY_PREIMAGE_DRIFT');
      await locked(q,false,async tx => insist(classify(await snapshot(tx),q) === 'EXACT_RERUN_NOOP', 'RECOVERY_DB_DRIFT'));
      recoveryStarted=true;
      osCall(c,q,'recovery-claim',{ nonce:r.approval_nonce,record:{ schema_version:2,operation_id:r.operation_id,original_supply_operation_id:q.operation_id,
        approval_nonce:r.approval_nonce,plan_digest:pd,approval_digest,original_supply_request_digest:digest(q),stage:'ATTEMPT_STARTED' } });
      const installed = osCall(c,q,'install',{expected_parent:fs.parent_identity,expected_escrow:fs.escrow_identity}).value;
      const safe = await locked(q,false,async tx => { const snapshotNow=await snapshot(tx); insist(matches(q,snapshotNow,credentialValue(privateCredential(c,q,false))), 'RECOVERY_VERIFY_FAILED'); return target(snapshotNow,q); });
      const receipt = { schema_version:2,phase:'recover-delivery',result:'RECOVERED',parent_delegation_id:r.parent_delegation_id,parent_delegation_digest:r.parent_delegation_digest,
        operation_id:r.operation_id,original_supply_operation_id:q.operation_id,approval_digest,approval_nonce:r.approval_nonce,
        original_audit_id:safe.audits[0].id,principal_id:safe.p[0].id,client_row_id:safe.cli[0].id,client_id:safe.cli[0].clientId,
        destination_identity:installed,secret_matches_verifier:true,effect_counts:{database:0,secret:0},verified_at:new Date().toISOString() };
      osCall(c,q,'recovery-append',{ recovery_operation:r.operation_id,record:{ stage:'RECOVERED',operation_id:r.operation_id,original_supply_operation_id:q.operation_id,receipt_digest:digest(receipt),file_identity:installed } });
      if(o.custody) { custodyCall(r.parent_delegation_id,'terminal-write',{capability:'recover-delivery',record:canonical(receipt)}); await o.custody.appendStage('recover-delivery','RECOVERED',digest(receipt)); }
      return receipt;
    } catch(e) { return validatePublicOutput(failure({...q,operation_id:r.operation_id},'recover-delivery',e instanceof Refusal?e.category:'RECOVERY_IO_FAILURE',recoveryStarted,recoveryStarted?'OUTCOME_UNKNOWN':'REFUSED')); }
    finally { if(lease) await lease.release(); if(control) await control.release(); }
  }
  return {
    coordinates: Object.freeze({ ...c }),
    async run(raw: string | Request, action: Action = 'plan', plan?: Json): Promise<Json> {
      let q: Request | undefined;
      try { const encoded = typeof raw === 'string' ? raw : JSON.stringify(raw);
        insist(!o.custody || !readonlyCustodies.has(o.custody) || ['verify','reconcile'].includes(action),'READONLY_CUSTODY');
        if ((parseClosedJson(encoded) as Json)?.phase === 'recover-delivery') return await recoverV2(encoded, action, plan);
        q = parseRequest(encoded);
        insist(action !== 'recover-delivery','DISTINCT_RECOVERY_REQUEST_REQUIRED');
        insist(['plan', 'apply', 'verify', 'reconcile'].includes(action), 'INVALID_ACTION');
        const result = action === 'apply' ? await mutate(q, action, plan) : await observe(q, action);
        const safe=validatePublicOutput(result);
        if(o.custody && action==='reconcile' && safe.error_class==='COMMITTED_DELIVERY_INCOMPLETE') authoritativeReconciliations.set(safe,q.parent_delegation_id);
        return safe;
      } catch (e) { return validatePublicOutput(failure(q, 'admission', e instanceof Refusal ? e.category : 'DB_OR_PROCESS_FAILURE',
        !!q && (action === 'apply' || action === 'recover-delivery') && e instanceof Refusal && e.category === 'OUTPUT_SCHEMA_INVALID',
        (['verify','reconcile'].includes(action) || e instanceof Refusal && e.category === 'OUTPUT_SCHEMA_INVALID' && (action === 'apply' || action === 'recover-delivery')) ? 'OUTCOME_UNKNOWN' : 'REFUSED')); }
    },
    close: () => db.$disconnect(),
  };
}

// Finite native-origin custody. A disk record is evidence, never an authentication factory.
export const PILOT_CAPABILITIES = ['registry-migrate-agent-v1', 'candidate-load', 'supply', 'registry-disable-migrated', 'recover-delivery'] as const;
export type PilotCapability = typeof PILOT_CAPABILITIES[number];
const capabilitySchema = z.enum(PILOT_CAPABILITIES);
const nonceSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const accountSchema = z.object({ name: z.literal('yanfenma'), uid: z.literal(502), gid: z.literal(20),
  generated_uid: z.literal('8C0B2274-84E0-456C-864B-C3208529C65A') }).strict();
const authorityPin = z.object({ ref, digest: sha }).strict();
const parentSchema = z.object({ schema_version: z.literal(2), delegation_id: uuid, issuer: z.literal('mayf3'), account: accountSchema,
  executor_ref: z.literal('01a0d846-431e-7dc0-95e2-a841cd0bff5a'),
  original_directive_sha256: z.literal('310589742f966dd176fac95d3360d2bdc6bf0109c2ba10ec9795f6bc76bc39c3'),
  environment: z.literal('production'), authority_pins: z.object({ supply_v2: authorityPin, audience_ccr: authorityPin, release_v1: authorityPin }).strict(),
  source_commit: git, source_tree: git, artifact_digest: sha, helper_digest: sha,
  fixed_target: z.object({ audience_id: z.literal(FIXED.resource), resource: z.literal(FIXED.resource), scope: z.literal(FIXED.scope),
    external_ref: z.literal(FIXED.externalRef), connector_scope: z.literal(FIXED.communicationScope), destination: z.literal(FIXED.destination) }).strict(),
  capabilities: z.tuple([z.literal('registry-migrate-agent-v1'), z.literal('candidate-load'), z.literal('supply'), z.literal('registry-disable-migrated'), z.literal('recover-delivery')]),
  issued_at: date, expires_at: date, parent_nonce: nonceSchema, authentication_receipt_digest: sha }).strict();
export type PilotParent = z.infer<typeof parentSchema>;
const intentSchema = parentSchema.omit({ issued_at: true, authentication_receipt_digest: true });
const childSchema = z.object({ schema_version: z.literal(2), parent_delegation_id: uuid, parent_delegation_digest: sha,
  phase: capabilitySchema, operation_id: uuid, plan_digest: sha, approval_nonce: nonceSchema,
  actor_ref: z.literal('01a0d846-431e-7dc0-95e2-a841cd0bff5a'), environment: z.literal('production'), source_commit: git,
  artifact_digest: sha, created_at: date, expires_at: date, attempts_max: z.literal(1) }).strict();
export type PilotChild = z.infer<typeof childSchema>;
export interface PilotChildRecord { child: PilotChild; plan: Json; childDigest: string; operationDirectory: string }
export interface PilotCustody {
  readonly parent: PilotParent; readonly parentDigest: string; readonly producerDigest: string; readonly producerStartNonce:string; readonly plannedLoadOperationId: string;
  readChild(capability: PilotCapability): Promise<PilotChildRecord>;
  allocate(capability: PilotCapability, plan: Json, dependencies?: Json): Promise<PilotChildRecord>;
  admit(capability: PilotCapability, planDigest: string): Promise<{ release(): Promise<void>; assertHeld(): void }>;
  appendStage(capability: PilotCapability, stage: string, evidenceDigest: string): Promise<void>;
  revoke(reason: 'EXECUTOR_STOP' | 'INTEGRITY_FAILURE'): Promise<void>;
}
const custodyRoot = '/private/var/db/auth-service/mcp-pilot-v2';
const liveCustodies = new Map<string, PilotCustody>();
const retainedWindows = new Map<string, { control: Awaited<ReturnType<typeof custodyLock>>; operation: Awaited<ReturnType<typeof acquireOsLock>>; record: Json }>();
// Every path component is opened relative to a pinned directory, never request-selected.
const CUSTODY_OS = String.raw`
import os,sys,json,stat,fcntl,re
x=json.loads(sys.stdin.readline()); fds=[]; pins=[]
def directory(parent,name,create=False):
 created=False
 if create:
  try: os.mkdir(name,0o700,dir_fd=parent); created=True
  except FileExistsError: pass
 f=os.open(name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent); fds.append(f)
 if created: os.fchown(f,0,0); os.fchmod(f,0o700); os.fsync(f); os.fsync(parent)
 s=os.fstat(f)
 if s.st_uid!=0 or s.st_gid!=0 or stat.S_IMODE(s.st_mode)!=0o700: raise Exception()
 pins.append((parent,name,s.st_dev,s.st_ino)); return f
def stable():
 for p,n,d,i in pins:
  s=os.stat(n,dir_fd=p,follow_symlinks=False)
  if not stat.S_ISDIR(s.st_mode) or (s.st_dev,s.st_ino)!=(d,i): raise Exception()
def read(fd,name):
 f=os.open(name,os.O_RDONLY|os.O_NOFOLLOW,dir_fd=fd)
 try:
  s=os.fstat(f)
  if not stat.S_ISREG(s.st_mode) or s.st_nlink!=1 or s.st_uid!=0 or s.st_gid!=0 or stat.S_IMODE(s.st_mode)!=0o600 or s.st_size>67108864: raise Exception()
  v=os.read(f,67108865); t=os.stat(name,dir_fd=fd,follow_symlinks=False)
  if (s.st_dev,s.st_ino)!=(t.st_dev,t.st_ino): raise Exception()
  return v.decode()
 finally: os.close(f)
def write(fd,name,value,append=False):
 f=os.open(name,os.O_WRONLY|os.O_NOFOLLOW|(os.O_APPEND if append else os.O_CREAT|os.O_EXCL),0o600,dir_fd=fd)
 try:
  s=os.fstat(f)
  if not stat.S_ISREG(s.st_mode) or s.st_nlink!=1 or s.st_uid!=0 or s.st_gid!=0 or stat.S_IMODE(s.st_mode)!=0o600: raise Exception()
  data=value.encode(); at=0
  while at<len(data): at+=os.write(f,data[at:])
  os.fsync(f)
 finally: os.close(f)
 os.fsync(fd); stable()
try:
 base=os.open('/',os.O_RDONLY|os.O_DIRECTORY); fds.append(base)
 isolated=x.get('isolatedRoot')
 if isolated and not re.fullmatch(r'/private/tmp/mcs-conformance-[A-Za-z0-9_-]+/case-[A-Za-z0-9_-]+',isolated): raise Exception()
 parts=isolated.strip('/').split('/') if isolated else ['private','var','db','auth-service']
 for part in parts:
  f=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=base); fds.append(f); s=os.fstat(f)
  if s.st_uid not in ((0,502) if isolated else (0,)) or (s.st_mode&0o022 and not (isolated and s.st_uid==0 and s.st_mode&stat.S_ISVTX)): raise Exception()
  pins.append((base,part,s.st_dev,s.st_ino)); base=f
 root=directory(base,'mcp-pilot-v2',x['command']=='initialize')
 parent=directory(root,x['delegation'],x['command']=='initialize')
 if x['command']=='initialize':
  directory(parent,'claims',True)
  for name,value in x['records'].items(): write(parent,name,value)
  write(parent,'control.lock',''); os.fsync(root)
 elif x['command']=='lock':
  f=os.open('control.lock',os.O_RDWR|os.O_NOFOLLOW,dir_fd=parent); fds.append(f); s=os.fstat(f)
  if not stat.S_ISREG(s.st_mode) or s.st_uid!=0 or s.st_gid!=0 or s.st_nlink!=1 or stat.S_IMODE(s.st_mode)!=0o600: raise Exception()
  fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB); stable()
  print(json.dumps({'ok':True,'value':{'pid':os.getpid(),'fd':f,'dev':s.st_dev,'ino':s.st_ino}}),flush=True); sys.stdin.readline(); sys.exit(0)
 elif x['command']=='read-parent':
  result={n:read(parent,n) for n in ['intent.json','authentication.json','delegation.json','producer.json','artifact-manifest.json']}
  result['revoked']='revoked.json' in os.listdir(parent)
  result['claim_names']=os.listdir(directory(parent,'claims'))
 elif x['command']=='write-window': write(parent,'window.json',x['record'])
 elif x['command']=='read-window': result=json.loads(read(parent,'window.json'))
 elif x['command']=='prepare':
  child=directory(parent,x['operation'],True); write(child,'dependencies.json',x['record']); os.fsync(parent)
 elif x['command']=='read-dependencies':
  child=directory(parent,x['operation']); result=json.loads(read(child,'dependencies.json'))
 elif x['command']=='witness-append':
  child=directory(parent,x['operation']); write(child,'witnesses.jsonl',x['record']+'\n','witnesses.jsonl' in os.listdir(child))
 elif x['command']=='witness-read':
  child=directory(parent,x['operation']); result=[json.loads(v) for v in read(child,'witnesses.jsonl').splitlines()] if 'witnesses.jsonl' in os.listdir(child) else []
 elif x['command']=='revoke': write(parent,'revoked.json',x['record'])
 else:
  claims=directory(parent,'claims')
  if x['command']=='allocate':
   write(claims,x['capability']+'.json',x['claim'])
   child=directory(parent,x['operation'],True)
   for name,value in x['records'].items():
    if name=='dependencies.json' and name in os.listdir(child):
     if value!=read(child,name): raise Exception()
    else: write(child,name,value)
   os.fsync(parent)
  else:
   claim=json.loads(read(claims,x['capability']+'.json')); child=directory(parent,claim['operation_id'])
   if x['command']=='read-child': result={n:read(child,n) for n in ['mandate.json','plan.json','stages.jsonl']}; result['claim']=claim
   elif x['command']=='terminal-write': write(child,'result.json',x['record'])
   elif x['command']=='terminal-read': result=json.loads(read(child,'result.json'))
   elif x['command']=='completion-history': result={'terminal':json.loads(read(child,'result.json')) if 'result.json' in os.listdir(child) else None,'stages':[json.loads(v) for v in read(child,'stages.jsonl').splitlines()]}
   elif x['command']=='completion-append': write(child,'completion.jsonl',x['record']+'\n','completion.jsonl' in os.listdir(child))
   elif x['command']=='reconciliation-write': write(child,'reconciliation.json',x['record'])
   elif x['command']=='reconciliation-read': result=json.loads(read(child,'reconciliation.json'))
   elif x['command']=='append': write(child,'stages.jsonl',x['record']+'\n',True)
 stable(); print(json.dumps({'ok':True,'value':locals().get('result',{})}))
except BaseException as e:
 if isinstance(e,SystemExit): raise
 print(json.dumps({'ok':False})); sys.exit(1)
`;
function custodyCall(id: string, command: string, extra: Json = {}): Json {
  uuid.parse(id); insist(process.getuid?.() === 0, 'OS_ACTOR_REQUIRED');
  const out = spawnSync('/usr/bin/python3', ['-c', CUSTODY_OS], { input: JSON.stringify({ delegation: id, command, ...extra }) + '\n', encoding: 'utf8', env: { PATH: '/usr/bin:/bin' }, maxBuffer: 70 * 1024 * 1024 });
  insist(out.status === 0, 'CUSTODY_INTEGRITY_FAILURE'); const result = parseClosedJson(out.stdout,70*1024*1024) as Json;
  insist(result.ok, 'CUSTODY_INTEGRITY_FAILURE'); return result.value;
}
/** Storage-only conformance seam. It cannot issue/register native custody handles. */
export function isolatedCustodyStorage(root: string) {
  insist(process.getuid?.()===0 && realpathSync(root)===root && /^\/private\/tmp\/mcs-conformance-[A-Za-z0-9_-]+\/case-[A-Za-z0-9_-]+$/.test(root),'NOT_ISOLATED_ROOT');
  const id=randomUUID();
  return { id, async concurrentAllocate(extra:Json) {
    const child=spawn('/usr/bin/python3',['-c',CUSTODY_OS],{stdio:['pipe','pipe','ignore'],env:{PATH:'/usr/bin:/bin'}});
    let output='';child.stdout.on('data',bytes=>output+=bytes);
    const finished=new Promise<Json>((resolve,reject)=>{child.once('error',()=>reject(new Refusal('CUSTODY_INTEGRITY_FAILURE')));child.once('exit',code=>{if(code!==0)reject(new Refusal('CUSTODY_INTEGRITY_FAILURE'));else try{resolve((parseClosedJson(output) as Json).value);}catch(e){reject(e);}});});
    child.stdin.end(JSON.stringify({...extra,command:'allocate',delegation:id,isolatedRoot:root})+'\n');return finished;
  }, call(command:string, extra:Json={}) {
    insist(['initialize','read-parent','allocate','read-child','revoke','prepare','read-dependencies','witness-append','witness-read'].includes(command),'ISOLATED_STORAGE_COMMAND');
    const out=spawnSync('/usr/bin/python3',['-c',CUSTODY_OS],{input:JSON.stringify({...extra,command,delegation:id,isolatedRoot:root})+'\n',encoding:'utf8',env:{PATH:'/usr/bin:/bin'}});
    insist(out.status===0,'CUSTODY_INTEGRITY_FAILURE');return (parseClosedJson(out.stdout) as Json).value;
  } };
}
/** Exercises only the real existing-ledger reservation primitive, never native origin. */
export function isolatedCapabilityLedger(root:string) {
  insist(process.getuid?.()===0 && realpathSync(root)===root && /^\/private\/tmp\/mcs-conformance-[A-Za-z0-9_-]+\/case-[A-Za-z0-9_-]+$/.test(root),'NOT_ISOLATED_ROOT');
  const c={root:join(root,'escrow'),destination:join(root,'mcp','native-conversation.service-v1.client.json'),uid:502,gid:20};
  return {async reserve(claim:Json){const lock=await acquireOsLock(c,{operation_id:claim.operation_id});try{lock.assertHeld();osCall(c,{operation_id:claim.operation_id},'capability-reserve',{capability:claim.capability,record:claim});}finally{await lock.release();}},
    verify(claim:Json){insist(equal(osCall(c,{operation_id:claim.operation_id},'capability-read',{capability:claim.capability}).value,claim),'GLOBAL_CLAIM_MISMATCH');}};
}
function originalCapability(custody:PilotCustody,command:'capability-reserve'|'capability-read',claim:Json) {
  const retained=retainedWindows.get(custody.parent.delegation_id);insist(retained,'ORIGINAL_WINDOW_OWNER_REQUIRED');
  retained.control.assertHeld();retained.operation.assertHeld();
  const actual=osCall({root:FIXED.escrow,destination:FIXED.destination,uid:FIXED.uid,gid:FIXED.gid},{operation_id:claim.operation_id},command,{capability:claim.capability,record:claim}).value;
  insist(equal(actual,claim),'GLOBAL_CLAIM_MISMATCH');
}
async function custodyLock(id: string) {
  let identity: Json = {};
  const child = spawn('/usr/bin/python3', ['-c', CUSTODY_OS], { stdio: ['pipe', 'pipe', 'ignore'], env: { PATH: '/usr/bin:/bin' } });
  child.stdin.write(JSON.stringify({ delegation: id, command: 'lock' }) + '\n');
  await new Promise<void>((resolve, reject) => { let out = ''; const timer = setTimeout(() => { child.kill(); reject(new Refusal('CUSTODY_LOCK_TIMEOUT')); }, 3000);
    child.once('error', () => { clearTimeout(timer); reject(new Refusal('CUSTODY_LOCK_LOST')); });
    child.once('exit', () => { clearTimeout(timer); reject(new Refusal('CUSTODY_LOCK_LOST')); });
    child.stdout.on('data', data => { out += data; if (out.includes('\n')) { clearTimeout(timer); try { const parsed=parseClosedJson(out) as Json; insist(parsed.ok, 'CUSTODY_LOCK_LOST'); identity=parsed.value; resolve(); } catch (e) { reject(e); } } }); });
  return { identity, assertHeld() { insist(child.exitCode === null && !child.killed, 'CUSTODY_LOCK_LOST'); },
    async release() { child.stdin.end('release\n'); await new Promise<void>(resolve => child.once('exit', () => resolve())); } };
}
const readonlyCustodies=new WeakSet<object>();
export async function openPilotCustody(delegationId: string, mode:'live'|'reconcile'='live'): Promise<PilotCustody> {
  uuid.parse(delegationId); const result = liveCustodies.get(delegationId);
  const records = custodyCall(delegationId, 'read-parent');
  const parent = parentSchema.parse(parseClosedJson(records['delegation.json']));
  const intent = intentSchema.parse(parseClosedJson(records['intent.json']));
  const authentication = parseClosedJson(records['authentication.json']) as Json;
  const producer = parseClosedJson(records['producer.json']) as Json;
  const manifest = parseClosedJson(records['artifact-manifest.json'],64*1024*1024) as Json;
  verifyProducer(parent, intent, authentication, producer, manifest,mode==='live');
  if(mode==='live' && result) return result;
  return buildCustody(parent, intent, authentication, producer, manifest,mode==='reconcile');
}
async function parentControl(id: string) {
  const retained = retainedWindows.get(id);
  if (!retained) return custodyLock(id);
  retained.control.assertHeld(); return { identity:retained.control.identity, assertHeld: () => retained.control.assertHeld(), release: async () => {} };
}
/** Retain the EXISTING lock in prescribed order; no second lock file or writer. */
export async function retainPilotWindow(custody: PilotCustody) {
  insist(liveCustodies.get(custody.parent.delegation_id) === custody && !retainedWindows.has(custody.parent.delegation_id), 'WINDOW_ORIGIN_REQUIRED');
  const prior=custodyCall(custody.parent.delegation_id,'read-parent'); insist(!prior.revoked && Date.now()<Date.parse(custody.parent.expires_at),'PARENT_EXPIRED_OR_REVOKED');
  const control = await custodyLock(custody.parent.delegation_id);
  try {
    const operation = await acquireOsLock({ root: FIXED.escrow, destination: FIXED.destination, uid: FIXED.uid, gid: FIXED.gid }, { operation_id: custody.parent.delegation_id });
    const record = { schema_version: 2, parent_delegation_id: custody.parent.delegation_id, parent_digest: custody.parentDigest,
      producer_digest: custody.producerDigest, window_id: randomUUID(), load_operation_id: custody.plannedLoadOperationId, holder: measureProducer(operation.identity.pid), control_holder:measureProducer(control.identity.pid),control_lock:control.identity,
      lock: operation.identity, observed_at: new Date().toISOString() };
    custodyCall(custody.parent.delegation_id, 'write-window', { record: canonical(record) });
    retainedWindows.set(custody.parent.delegation_id, { control, operation, record });
    return { windowId: record.window_id, loadOperationId: record.load_operation_id, assertHeld() { control.assertHeld(); operation.assertHeld(); },
      async release() { operation.assertHeld(); await operation.release(); retainedWindows.delete(custody.parent.delegation_id); await control.release(); } };
  } catch (e) { await control.release(); throw e; }
}
export async function verifyPilotWindow(custody: PilotCustody): Promise<{ windowId: string; holderProcesses: Array<{pid:number;start_time:string}>; assertHeld(): void }> {
  const record = custodyCall(custody.parent.delegation_id, 'read-window');
  insist(keysEqual(record, ['schema_version','parent_delegation_id','parent_digest','producer_digest','window_id','load_operation_id','holder','control_holder','control_lock','lock','observed_at']) &&
    record.schema_version === 2 && record.parent_delegation_id === custody.parent.delegation_id && record.parent_digest === custody.parentDigest &&
    record.producer_digest === custody.producerDigest && uuid.safeParse(record.window_id).success && uuid.safeParse(record.load_operation_id).success, 'WINDOW_BINDING_INVALID');
  function assertHeld() {
    const original = retainedWindows.get(custody.parent.delegation_id);
    if (original) { original.control.assertHeld(); original.operation.assertHeld(); insist(equal(original.record, record), 'WINDOW_DRIFT'); return; }
    insist(equal(measureProducer(record.holder.pid), record.holder) && equal(measureProducer(record.control_holder.pid),record.control_holder), 'WINDOW_GENERATION_LOST');
    for(const item of [{path:join(FIXED.escrow,'operation.lock'),lock:record.lock,holder:record.holder},
      {path:join(custodyRoot,custody.parent.delegation_id,'control.lock'),lock:record.control_lock,holder:record.control_holder}]) {
      const st=lstatSync(item.path);
      insist(st.isFile() && !st.isSymbolicLink() && st.uid===0 && st.gid===0 && st.nlink===1 && (st.mode&0o777)===0o600 &&
        st.dev===item.lock.dev && st.ino===item.lock.ino && item.lock.pid===item.holder.pid,'WINDOW_INODE_DRIFT');
      const open=spawnSync('/usr/sbin/lsof',['-a','-p',String(item.holder.pid),'-d',String(item.lock.fd),'-Ffin'],{encoding:'utf8'});
      insist(open.status===0 && open.stdout.split('\n').includes('i'+st.ino) && open.stdout.split('\n').includes('n'+item.path),'WINDOW_DESCRIPTOR_LOST');
      const probe=spawnSync('/usr/bin/python3',['-c','import os,fcntl,sys; f=os.open(sys.argv[1],os.O_RDWR|os.O_NOFOLLOW);\ntry: fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB); sys.exit(1)\nexcept BlockingIOError: sys.exit(0)',item.path]);
      insist(probe.status===0,'WINDOW_LOCK_LOST');
    }
  }
  assertHeld(); const holderProcesses=[record.holder,record.control_holder].map(holder=>{const ps=spawnSync('/bin/ps',['-p',String(holder.pid),'-o','lstart='],{encoding:'utf8'});insist(ps.status===0 && ps.stdout.trim(),'WINDOW_GENERATION_LOST');return {pid:holder.pid,start_time:ps.stdout.trim()};});
  return { windowId: record.window_id, holderProcesses, assertHeld };
}
/** Original executor preparation, not PLAN: generates coordinates and seals actual
 * producer observations before the read-only engine plans or allocates a child. */
export async function preparePilotRequest(custody: PilotCustody, phase: Exclude<PilotCapability,'candidate-load'|'recover-delivery'>,
  measure: (coordinates: { operationId:string; approvalNonce:string; expiresAt:string }) => Promise<{ dependencies:Dependencies; witness:Json }>): Promise<Request> {
  insist(['registry-migrate-agent-v1','registry-disable-migrated','supply'].includes(phase), 'PARENT_CAPABILITY_REFUSED');
  const window = await verifyPilotWindow(custody); window.assertHeld();
  const operationId=randomUUID(), approvalNonce=randomBytes(32).toString('base64url'), createdAt=new Date().toISOString();
  const expiresAt=new Date(Math.min(Date.now()+600000,Date.parse(custody.parent.expires_at))).toISOString();
  const measured=await measure({operationId,approvalNonce,expiresAt}), d=dependenciesSchema.parse(measured.dependencies), p=custody.parent;
  const base = {schema_version:2,parent_delegation_id:p.delegation_id,parent_delegation_digest:custody.parentDigest,phase,operation_id:operationId,
    environment:p.environment,source_commit:p.source_commit,spec_ref:p.authority_pins.supply_v2.ref,spec_digest:p.authority_pins.supply_v2.digest,
    audience_authority_ref:p.authority_pins.audience_ccr.ref,audience_authority_digest:p.authority_pins.audience_ccr.digest,
    bundle_digest:d.bundle_digest,runtime_digest:d.runtime_digest,runtime_preimage_receipt_ref:d.runtime_preimage_receipt_ref,
    runtime_preimage_receipt_digest:d.runtime_preimage_receipt_digest,operator_ref:p.executor_ref,
    approval_ref:join(custodyRoot,p.delegation_id,operationId,'mandate.json'),approval_nonce:approvalNonce,created_at:createdAt,expires_at:expiresAt};
  const q=parseRequest(JSON.stringify({...base,...(phase==='supply'?{connector_config_receipt_ref:d.connector_config_receipt_ref,
    connector_config_receipt_digest:d.connector_config_receipt_digest,connector_subject:d.connector_subject,registry_receipt_ref:d.registry_receipt_ref,
    registry_receipt_digest:d.registry_receipt_digest}:{stop_serving_receipt_ref:d.stop_serving_receipt_ref,stop_serving_receipt_digest:d.stop_serving_receipt_digest})}));
  const witness=validateDependencyWitness(measured.witness,p,q,phase==='supply'?'alignment':'stop');
  insist(witness.window_id===window.windowId && witness.producer_start_nonce===custody.producerStartNonce,'WINDOW_WITNESS_MISMATCH');
  const record={schema_version:2,parent_delegation_id:p.delegation_id,operation_id:operationId,producer_digest:custody.producerDigest,dependencies:d,witness};
  const lock=await parentControl(p.delegation_id);
  try{lock.assertHeld();window.assertHeld();custodyCall(p.delegation_id,'prepare',{operation:operationId,record:canonical(record)});}finally{await lock.release();}
  return q;
}
export async function preparePilotRecoveryRequest(custody:PilotCustody,
  measure:(coordinates:{operationId:string;approvalNonce:string;expiresAt:string})=>Promise<{dependencies:Dependencies;witness:Json}>):Promise<RecoveryRequest> {
  const original=await custody.readChild('supply');
  const q=parseRequest(JSON.stringify({...original.plan.request,approval_digest:original.childDigest}));
  const receipt=custodyCall(custody.parent.delegation_id,'reconciliation-read',{capability:'supply'});
  insist(receipt.error_class==='COMMITTED_DELIVERY_INCOMPLETE' && receipt.operation_id===q.operation_id,'RECOVERY_RECONCILIATION_REQUIRED');
  const window=await verifyPilotWindow(custody);window.assertHeld();
  const operationId=randomUUID(),approvalNonce=randomBytes(32).toString('base64url'),createdAt=new Date().toISOString(),
    expiresAt=new Date(Math.min(Date.now()+600000,Date.parse(custody.parent.expires_at))).toISOString();
  const measured=await measure({operationId,approvalNonce,expiresAt});const d=dependenciesSchema.parse(measured.dependencies);
  const witness=validateDependencyWitness(measured.witness,custody.parent,{...q,operation_id:operationId,expires_at:expiresAt},'alignment');
  insist(witness.window_id===window.windowId && witness.producer_start_nonce===custody.producerStartNonce,'WINDOW_WITNESS_MISMATCH');
  const r=recoveryRequestSchema.parse({schema_version:2,phase:'recover-delivery',parent_delegation_id:q.parent_delegation_id,parent_delegation_digest:q.parent_delegation_digest,
    operation_id:operationId,original_supply_operation_id:q.operation_id,original_supply_request_digest:digest(q),original_supply_receipt_digest:digest(receipt),
    source_commit:q.source_commit,spec_ref:q.spec_ref,spec_digest:q.spec_digest,operator_ref:q.operator_ref,
    approval_ref:join(custodyRoot,q.parent_delegation_id,operationId,'mandate.json'),approval_nonce:approvalNonce,created_at:createdAt,expires_at:expiresAt});
  const lock=await parentControl(q.parent_delegation_id);
  try{lock.assertHeld();window.assertHeld();custodyCall(q.parent_delegation_id,'prepare',{operation:operationId,record:canonical({schema_version:2,
    parent_delegation_id:q.parent_delegation_id,operation_id:operationId,producer_digest:custody.producerDigest,dependencies:d,witness})});}finally{await lock.release();}
  return r;
}
export async function readPilotTerminal(custody: PilotCustody, capability: PilotCapability): Promise<Json> {
  const child = await custody.readChild(capability);
  const terminal = validatePublicOutput(custodyCall(custody.parent.delegation_id,'terminal-read',{capability}));
  const stages = custodyCall(custody.parent.delegation_id,'read-child',{capability})['stages.jsonl'].trim().split('\n').map((line:string)=>parseClosedJson(line) as Json);
  insist(terminal.operation_id === child.child.operation_id && terminal.parent_delegation_id === custody.parent.delegation_id &&
    stages.at(-1)?.stage === 'COMMITTED' && stages.at(-1)?.evidence_digest === digest(terminal), 'TERMINAL_RECEIPT_UNPROVEN');
  return terminal;
}
const authoritativeReconciliations=new WeakMap<object,string>();
/** Validation shared by real protected custody reads and isolated engine evidence. No authority is created. */
export function validateRecoveredSupplyCompletion(q:Request,plan:Json,reconciliation:Json,r:RecoveryRequest,recoveryPlan:Json,recovered:Json,current:Json,fence:Json[]):Json {
  const prior=failureSchema.parse(reconciliation), now=supplyReceiptSchema.parse(current);
  insist(q.phase==='supply' && equal(plan.request,unsigned(q)) && plan.plan_digest===planHash(q,plan.prestate,plan.classification) && prior.error_class==='COMMITTED_DELIVERY_INCOMPLETE' && prior.residual_coordinates.state==='committed_delivery_incomplete' &&
    prior.operation_id===q.operation_id && prior.parent_delegation_id===q.parent_delegation_id && prior.parent_delegation_digest===q.parent_delegation_digest &&
    r.original_supply_operation_id===q.operation_id && r.operation_id!==q.operation_id && r.original_supply_request_digest===digest(q) &&
    r.original_supply_receipt_digest===digest(prior) && r.parent_delegation_id===q.parent_delegation_id && r.parent_delegation_digest===q.parent_delegation_digest &&
    equal(recoveryPlan.request,Object.fromEntries(Object.entries(r).filter(([k])=>k!=='approval_digest'))) &&
    recoveryPlan.plan_digest===planHash(recoveryPlan.request,recoveryPlan.prestate,recoveryPlan.classification) &&
    recovered.result==='RECOVERED' && recovered.operation_id===r.operation_id && recovered.original_supply_operation_id===q.operation_id &&
    recovered.parent_delegation_id===q.parent_delegation_id && recovered.parent_delegation_digest===q.parent_delegation_digest &&
    recovered.approval_digest===r.approval_digest && recovered.approval_nonce===r.approval_nonce &&
    recovered.original_audit_id===prior.residual_coordinates.audit_id && recovered.secret_matches_verifier===true && equal(recovered.effect_counts,{database:0,secret:0}) &&
    now.result==='EXACT_RERUN_NOOP' && now.operation_id===q.operation_id && now.audit_id===recovered.original_audit_id && now.approval_nonce===q.approval_nonce &&
    now.parent_delegation_id===q.parent_delegation_id && now.parent_delegation_digest===q.parent_delegation_digest && now.plan_digest===plan.plan_digest &&
    (['principal_id','client_row_id','client_id'] as const).every(k=>now[k]===recovered[k]) && Object.values(now.effect_counts).every(n=>n===0) &&
    fence[0]?.operation_id===q.operation_id && fence[0]?.request_digest===digest(q) && fence[0]?.approval_nonce===q.approval_nonce && fence[0]?.plan_digest===plan.plan_digest,
    'RECOVERED_COMPLETION_CHAIN_INVALID');
  return {schema_version:2,result:'RECOVERED',operation_id:q.operation_id,original_supply_operation_id:q.operation_id,recovery_operation_id:r.operation_id,
    parent_delegation_id:q.parent_delegation_id,parent_delegation_digest:q.parent_delegation_digest,original_plan_digest:plan.plan_digest,
    reconciliation_digest:digest(prior),recovery_receipt_digest:digest(recovered),current_delivery_receipt_digest:digest(now),original_fence_digest:digest(fence),current_delivery_receipt:now};
}
/** A new reconciliation receipt; never an invented original COMMITTED stage. Caller must supply authoritative reads. */
export function validateReconciledSupplyCompletion(q:Request,plan:Json,current:Json,fence:Json[],terminal:Json|null,stages:Json[],child:Json):Json {
  const now=supplyReceiptSchema.parse(current);
  const pins=['operation_id','parent_delegation_id','parent_delegation_digest','approval_nonce'] as const;
  insist(q.phase==='supply' && equal(plan.request,unsigned(q)) && plan.plan_digest===planHash(q,plan.prestate,plan.classification) &&
    plan.prestate_digest===digest(plan.prestate) && child.plan_digest===plan.plan_digest && pins.every(k=>child[k]===q[k]) &&
    now.result==='EXACT_RERUN_NOOP' && pins.every(k=>now[k]===q[k]) && now.approval_digest===q.approval_digest &&
    now.plan_digest===plan.plan_digest && (['environment','operator_ref','approval_ref','source_commit','spec_ref','spec_digest','connector_subject','connector_config_receipt_ref','connector_config_receipt_digest'] as const).every(k=>now[k]===q[k as keyof Request]) && Object.values(now.effect_counts).every(n=>n===0) &&
    fence.length>0 && fence.every(row=>row.operation_id===q.operation_id && row.request_digest===digest(q) && row.approval_nonce===q.approval_nonce && row.plan_digest===plan.plan_digest) &&
    fence[0].stage==='ATTEMPT_STARTED' && fence.some(row=>row.stage==='COMMIT_REQUESTED') && fence.some(row=>row.stage==='DESTINATION_DURABLE'),
    'RECONCILED_COMPLETION_CHAIN_INVALID');
  if(terminal!==null){
    const old=supplyReceiptSchema.parse(terminal);
    const fixed=(value:Json)=>Object.fromEntries(Object.entries(value).filter(([k])=>!['result','effect_counts','prestate_digest','poststate_digest','verified_at'].includes(k)));
    insist(old.result==='COMMITTED' && equal(old.effect_counts,{principal:1,client:1,grant:1,audit:1}) &&
      old.prestate_digest===plan.prestate_digest && equal(fixed(old),fixed(now)),'ORIGINAL_TERMINAL_CONFLICT');
  }
  for(const stage of stages){
    insist(!['REFUSED','RECOVERED','STOPPED','ALIGNED'].includes(stage.stage),'ORIGINAL_TERMINAL_CONFLICT');
    if(stage.stage==='COMMITTED')insist(terminal!==null && stage.evidence_digest===digest(terminal),'ORIGINAL_TERMINAL_CONFLICT');
    if(stage.stage==='ATTEMPT_STARTED' || stage.stage==='COMMIT_REQUESTED')insist(stage.evidence_digest===plan.plan_digest,'ORIGINAL_TERMINAL_CONFLICT');
  }
  return {schema_version:2,result:'EXACT_RERUN_NOOP',completion_basis:'authoritative_reconciliation',operation_id:q.operation_id,
    parent_delegation_id:q.parent_delegation_id,parent_delegation_digest:q.parent_delegation_digest,original_plan_digest:plan.plan_digest,
    original_child_digest:q.approval_digest,original_request_digest:digest(q),original_fence_digest:digest(fence),
    original_terminal_digest:terminal===null?null:digest(terminal),original_stages_digest:digest(stages),
    current_delivery_receipt_digest:digest(now),current_delivery_receipt:now};
}
/** Actual current DB/audit/delivery readback closes recovery without inventing an original success receipt. */
export async function readPilotSupplyCompletion(custody:PilotCustody):Promise<Json> {
  const original=await custody.readChild('supply');
  const q=parseRequest(JSON.stringify({...original.plan.request,approval_digest:original.childDigest}));
  const current=await cli(['supply','reconcile'],JSON.stringify(q));
  insist(current.result==='EXACT_RERUN_NOOP','CURRENT_SUPPLY_COMPLETION_UNPROVEN');
  let hasRecovery=false;
  const parent=custodyCall(custody.parent.delegation_id,'read-parent');hasRecovery=parent.claim_names.includes('recover-delivery.json');
  const fs=fileState({root:FIXED.escrow,destination:FIXED.destination,uid:FIXED.uid,gid:FIXED.gid},q);
  const fence=(fs.fences as Json[][]).find(rows=>rows[0]?.operation_id===q.operation_id);
  insist(fence,'ORIGINAL_FENCE_REQUIRED');
  if(!hasRecovery){
    const history=custodyCall(custody.parent.delegation_id,'completion-history',{capability:'supply'});
    const completion=validateReconciledSupplyCompletion(q,original.plan,current,fence,history.terminal,history.stages,original.child);
    insist(!readonlyCustodies.has(custody) && liveCustodies.get(custody.parent.delegation_id)===custody,'ORIGINAL_WINDOW_OWNER_REQUIRED');
    const window=await verifyPilotWindow(custody);window.assertHeld();
    custodyCall(custody.parent.delegation_id,'completion-append',{capability:'supply',record:canonical(completion)});
    return completion;
  }
  const recovery=await custody.readChild('recover-delivery');
  const r=parseRecoveryRequest(JSON.stringify({...recovery.plan.request,approval_digest:recovery.childDigest}));
  const recovered=custodyCall(custody.parent.delegation_id,'terminal-read',{capability:'recover-delivery'});
  const raw=custodyCall(custody.parent.delegation_id,'read-child',{capability:'recover-delivery'})['stages.jsonl'];
  let previous=custody.parentDigest;const stages=raw.trim().split('\n').map((line:string)=>parseClosedJson(line) as Json);
  for(const stage of stages){insist(stage.parent_delegation_id===custody.parent.delegation_id && stage.capability==='recover-delivery' && stage.previous_digest===previous,'RECOVERY_STAGE_CHAIN_INVALID');previous=digest(stage);}
  insist(stages.at(-1)?.stage==='RECOVERED' && stages.at(-1)?.evidence_digest===digest(recovered),'RECOVERY_TERMINAL_UNPROVEN');
  const completion=validateRecoveredSupplyCompletion(q,original.plan,custodyCall(custody.parent.delegation_id,'reconciliation-read',{capability:'supply'}),r,recovery.plan,recovered,current,fence);
  insist(!readonlyCustodies.has(custody) && liveCustodies.get(custody.parent.delegation_id)===custody,'ORIGINAL_WINDOW_OWNER_REQUIRED');
  const window=await verifyPilotWindow(custody);window.assertHeld();
  custodyCall(custody.parent.delegation_id,'completion-append',{capability:'supply',record:canonical(completion)});
  return completion;
}
export async function recordPilotReconciliation(custody: PilotCustody, receipt: Json): Promise<void> {
  insist(!readonlyCustodies.has(custody) && liveCustodies.get(custody.parent.delegation_id)===custody && authoritativeReconciliations.get(receipt)===custody.parent.delegation_id,'AUTHORITATIVE_RECONCILIATION_REQUIRED');
  const child = await custody.readChild('supply');
  const safe = failureSchema.parse(receipt);
  insist(safe.operation_id === child.child.operation_id && safe.parent_delegation_id === custody.parent.delegation_id &&
    safe.parent_delegation_digest === custody.parentDigest && safe.error_class === 'COMMITTED_DELIVERY_INCOMPLETE' &&
    safe.residual_coordinates.state === 'committed_delivery_incomplete', 'RECOVERY_RECONCILIATION_REQUIRED');
  const lock = await parentControl(custody.parent.delegation_id);
  try { lock.assertHeld(); custodyCall(custody.parent.delegation_id, 'reconciliation-write', { capability: 'supply', record: canonical(safe) }); }
  finally { await lock.release(); }
}
export async function verifyPilotAdmission(custody: PilotCustody, capability: PilotCapability): Promise<PilotChildRecord> {
  const child = await custody.readChild(capability);
  const raw = custodyCall(custody.parent.delegation_id, 'read-child', { capability })['stages.jsonl'];
  const stages = raw.trim().split('\n').map((line: string) => parseClosedJson(line) as Json);
  insist(stages.length === 2 && stages[0].stage === 'ISSUED' && stages[1].stage === 'ATTEMPT_STARTED' &&
    stages[0].previous_digest === custody.parentDigest && stages[1].previous_digest === digest(stages[0]) &&
    stages.every((stage: Json) => stage.parent_delegation_id === custody.parent.delegation_id && stage.capability === capability) &&
    stages[0].evidence_digest === child.childDigest && stages[1].evidence_digest === child.child.plan_digest &&
    Date.now() < Date.parse(child.child.expires_at), 'CHILD_NOT_EXACTLY_ADMITTED');
  return child;
}
export function decodeNativeFrame(frame: Buffer): Json {
  insist(frame.length >= 4 && frame.readUInt32BE(0) > 0 && frame.readUInt32BE(0) <= 65536 && frame.length === 4 + frame.readUInt32BE(0), 'NATIVE_FRAME_INVALID');
  const value = parseClosedJson(frame.subarray(4).toString('utf8')) as Json;
  insist(canonical(value) === frame.subarray(4).toString('utf8'), 'NATIVE_FRAME_NONCANONICAL'); return value;
}
function nativeFrame(value: Json) { const body = Buffer.from(canonical(value)); insist(body.length <= 65536, 'NATIVE_FRAME_INVALID');
  const length = Buffer.alloc(4); length.writeUInt32BE(body.length); return Buffer.concat([length, body]); }
const PRODUCER_MEASURE = String.raw`
import ctypes,json,sys,os
class Bsd(ctypes.Structure):
 _fields_=[(n,ctypes.c_uint32) for n in ['flags','status','xstatus','pid','ppid','uid','gid','ruid','rgid','svuid','svgid','rfu']]+[('comm',ctypes.c_char*16),('name',ctypes.c_char*32)]+[(n,ctypes.c_uint32) for n in ['nfiles','pgid','pjobc','e_tdev','e_tpgid','nice']]+[('start_sec',ctypes.c_uint64),('start_usec',ctypes.c_uint64)]
pid=int(sys.argv[1]); lib=ctypes.CDLL('/usr/lib/libproc.dylib'); info=Bsd(); path=ctypes.create_string_buffer(4096)
if lib.proc_pidinfo(pid,3,0,ctypes.byref(info),ctypes.sizeof(info))!=ctypes.sizeof(info) or lib.proc_pidpath(pid,path,4096)<=0: sys.exit(1)
libc=ctypes.CDLL('/usr/lib/libSystem.B.dylib'); mib=(ctypes.c_int*3)(1,49,pid); size=ctypes.c_size_t(262144); args=ctypes.create_string_buffer(size.value)
if libc.sysctl(mib,3,args,ctypes.byref(size),None,0)!=0: sys.exit(1)
raw=args.raw[:size.value]; argc=int.from_bytes(raw[:4],sys.byteorder); at=raw.index(b'\0',4)+1
while at<len(raw) and raw[at]==0: at+=1
argv=raw[at:].split(b'\0')[:argc]
print(json.dumps({'pid':pid,'uid':info.uid,'gid':info.gid,'start_sec':info.start_sec,'start_usec':info.start_usec,'executable':path.value.decode(),'argv':[a.decode() for a in argv]}))
`;
function measureProducer(pid: number): Json {
  insist(Number.isSafeInteger(pid) && pid > 0 && process.platform === 'darwin', 'PRODUCER_UNAVAILABLE');
  const result = spawnSync('/usr/bin/python3', ['-c', PRODUCER_MEASURE, String(pid)], { encoding: 'utf8', env: { PATH: '/usr/bin:/bin' } });
  insist(result.status === 0, 'PRODUCER_UNAVAILABLE'); return parseClosedJson(result.stdout) as Json;
}
function executableInput(path:string): Json {
  const resolved=realpathSync(path);insist(resolved===path,'EXECUTABLE_SYMLINK_REFUSED');
  const st=lstatSync(path);insist(st.isFile() && st.nlink===1 && st.uid===0 && st.gid===0 && !(st.mode&0o022),'EXECUTABLE_INPUT_UNSAFE');
  return {path,dev:st.dev,ino:st.ino,uid:st.uid,gid:st.gid,mode:st.mode&0o777,size:st.size,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')};
}
/** Exact original outer inputs, measured before the artifact manifest is sealed.
 * The original outer is not the later final-root serving/supervisor process. */
export const PILOT_STAGING_ROOT = '/private/var/db/auth-service/mcp-pilot-v2/staging';
export function measurePilotOuterInputs(): Json {
  const processInfo=measureProducer(process.pid);
  insist(processInfo.argv.length===2 && processInfo.argv[0]===processInfo.executable,'OUTER_ARGV_INVALID');
  insist(process.cwd()===PILOT_STAGING_ROOT && fileURLToPath(import.meta.url)===join(PILOT_STAGING_ROOT,'dist/scripts/supply-mcp-conversation-pilot-v1.js'),'OUTER_MODULE_OR_CWD_INVALID');
  return {staging_root:PILOT_STAGING_ROOT,node:executableInput(processInfo.executable),launcher:executableInput(processInfo.argv[1]),supply_module:executableInput(fileURLToPath(import.meta.url))};
}
function verifyOuterInputs(manifest:Json, processInfo:Json) {
  const inputs=manifest.build_inputs?.outer_executor;
  insist(inputs && keysEqual(inputs,['staging_root','node','launcher','supply_module']) && inputs.staging_root===PILOT_STAGING_ROOT && processInfo.argv.length===2 && processInfo.argv[0]===processInfo.executable &&
    processInfo.argv[1]===inputs.launcher.path && processInfo.executable===inputs.node.path,'OUTER_INPUT_BINDING_INVALID');
  insist(inputs.node.path===join(PILOT_STAGING_ROOT,manifest.entrypoints.node) && inputs.launcher.path===join(PILOT_STAGING_ROOT,manifest.entrypoints.outer_launcher) && inputs.supply_module.path===join(PILOT_STAGING_ROOT,'dist/scripts/supply-mcp-conversation-pilot-v1.js'),'OUTER_STAGING_ORIGIN_INVALID');
  // Both complete graphs are checked, including all packages and internal links.
  validateArtifact(PILOT_STAGING_ROOT,manifest);
  validateArtifact('/Library/Application Support/auth-service/mcp-pilot-v2/releases/'+manifest.artifact_digest,manifest);
  for(const key of ['node','launcher','supply_module']) insist(equal(executableInput(inputs[key].path),inputs[key]),'OUTER_EXECUTABLE_DRIFT');
  insist(manifest.files.some((file:Json)=>file.path===manifest.entrypoints.outer_launcher && file.sha256===inputs.launcher.sha256) &&
    manifest.files.some((file:Json)=>file.path===manifest.entrypoints.node && file.sha256===inputs.node.sha256) &&
    manifest.files.some((file:Json)=>file.path==='dist/scripts/supply-mcp-conversation-pilot-v1.js' && file.sha256===inputs.supply_module.sha256),'OUTER_ARTIFACT_INPUT_MISMATCH');
}
function verifyProducer(parent: PilotParent, intent: Json, authentication: Json, producer: Json, manifest: Json, live=true) {
  const producerSchema = z.object({ schema_version: z.literal(2), delegation_id: uuid, load_operation_id:uuid, receiver_start_nonce: nonceSchema,
    process: z.object({ pid: z.number().int().positive(), uid: z.literal(0), gid: z.literal(0), start_sec: z.number().int().nonnegative(),
      start_usec: z.number().int().nonnegative(), executable: z.string(), argv: z.array(z.string()).min(2).max(6) }).strict(), executable_digest: sha,
    receiver_entry: z.string(), receiver_entry_digest: sha, source_commit: git, artifact_digest: sha,
    intent_digest: sha, authentication_receipt_digest: sha, parent_digest: sha, created_at: date }).strict();
  producerSchema.parse(producer);
  const authSchema = z.object({ schema_version: z.literal(2), delegation_id: uuid, intent_digest: sha, challenge_nonce: nonceSchema,
    helper_digest: sha, receiver_source_commit: git, receiver_start_nonce: nonceSchema, helper_pid: z.number().int().positive(),
    helper_start_nonce: nonceSchema, account: accountSchema, policy: z.literal('deviceOwnerAuthentication'), reuse_seconds: z.literal(0),
    result: z.literal('authenticated'), authenticated_at: date, deadline: date }).strict();
  authSchema.parse(authentication);
  insist(equal(intent, intentSchema.parse(Object.fromEntries(Object.entries(parent).filter(([k]) => !['issued_at','authentication_receipt_digest'].includes(k))))) &&
    producer.delegation_id === parent.delegation_id && producer.parent_digest === digest(parent) && producer.intent_digest === digest(intent) &&
    producer.authentication_receipt_digest === digest(authentication) && parent.authentication_receipt_digest === digest(authentication) &&
    authentication.delegation_id === parent.delegation_id && authentication.intent_digest === digest(intent) && authentication.helper_digest === parent.helper_digest &&
    authentication.receiver_start_nonce === producer.receiver_start_nonce && authentication.receiver_source_commit === parent.source_commit &&
    producer.source_commit === parent.source_commit && producer.artifact_digest === parent.artifact_digest && equal(authentication.account, parent.account) &&
    authentication.authenticated_at === parent.issued_at && Date.parse(authentication.authenticated_at) <= Date.parse(authentication.deadline) &&
    (!live || equal(measureProducer(producer.process.pid), producer.process)), 'NATIVE_ORIGIN_CHAIN_INVALID');
  const base = '/Library/Application Support/auth-service/mcp-pilot-v2/releases/' + parent.artifact_digest;
  insist(manifest.artifact_digest === parent.artifact_digest && digest(Object.fromEntries(Object.entries(manifest).filter(([k])=>k!=='artifact_digest'))) === parent.artifact_digest &&
    typeof manifest.entrypoints?.outer_launcher === 'string' && !manifest.entrypoints.outer_launcher.includes('..') && !manifest.entrypoints.outer_launcher.startsWith('/'), 'OUTER_MANIFEST_INVALID');
  verifyOuterInputs(manifest,producer.process);
  insist(producer.receiver_entry===manifest.build_inputs.outer_executor.launcher.path && producer.receiver_entry_digest===manifest.build_inputs.outer_executor.launcher.sha256,'PRODUCER_ENTRY_INVALID');
  for (const [path, expected] of [[producer.process.executable, producer.executable_digest], [producer.receiver_entry, producer.receiver_entry_digest]]) {
    const st = lstatSync(path); insist(st.uid === 0 && st.nlink === 1 && st.isFile() && !st.isSymbolicLink() && !(st.mode & 0o022) &&
      createHash('sha256').update(readFileSync(path)).digest('hex') === expected, 'PRODUCER_EXECUTABLE_DRIFT');
  }
}
export interface PilotPreparation { readonly delegationId:string; readonly loadOperationId:string; readonly parentNonce:string; readonly createdAt:string; readonly expiresAt:string; readonly preimageDirectory:string }
const pilotPreparations=new WeakSet<object>();
/** Coordinates only: this creates no authentication, mandate, claim or filesystem. */
export function preparePilotCoordinates(): PilotPreparation {
  const delegationId=randomUUID(),loadOperationId=randomUUID(),created=Date.now();
  const prepared=Object.freeze({delegationId,loadOperationId,parentNonce:randomBytes(32).toString('base64url'),createdAt:new Date(created).toISOString(),
    expiresAt:new Date(created+3600000).toISOString(),preimageDirectory:join(custodyRoot,delegationId,loadOperationId,'preimage')});
  pilotPreparations.add(prepared);return prepared;
}
/** Reservation identity only; does not authenticate, touch custody or issue effects. */
export function validatePilotPreparation(preparation:PilotPreparation):void {
  insist(pilotPreparations.has(preparation) && Object.isFrozen(preparation),'ORIGINAL_PREPARATION_REQUIRED');
  const created=Date.parse(preparation.createdAt),expires=Date.parse(preparation.expiresAt);
  insist(uuid.safeParse(preparation.delegationId).success && uuid.safeParse(preparation.loadOperationId).success && nonceSchema.safeParse(preparation.parentNonce).success &&
    Number.isFinite(created) && created<=Date.now() && expires> Date.now() && expires<=created+3600000 &&
    preparation.preimageDirectory===join(custodyRoot,preparation.delegationId,preparation.loadOperationId,'preimage'),'PREPARATION_BINDING_INVALID');
}
/** Called only by the original outer executor after its artifact/plan preparation.
 * This runs a REAL native prompt; conformance never calls this success path. */
export async function authenticatePilot(input: Omit<z.infer<typeof intentSchema>, 'delegation_id' | 'parent_nonce'>, measuredManifest: unknown, preparation: PilotPreparation): Promise<PilotCustody> {
  insist(process.platform === 'darwin' && process.getuid?.() === 0, 'NATIVE_ACTOR_REQUIRED');
  insist(!Object.entries(process.env).some(([key,value])=>value && (/^DYLD_/.test(key) || ['NODE_OPTIONS','NODE_PATH','LD_PRELOAD','PYTHONPATH','PYTHONHOME'].includes(key))), 'NATIVE_ENV_INJECTION');
  validatePilotPreparation(preparation);
  const created = Date.now();
  insist(input.expires_at===preparation.expiresAt && Date.parse(preparation.expiresAt)<=Date.parse(preparation.createdAt)+3600000,'PREPARATION_EXPIRY_INVALID');
  const intent = intentSchema.parse({ ...input, delegation_id: preparation.delegationId, parent_nonce: preparation.parentNonce });
  pilotPreparations.delete(preparation);
  insist(Date.parse(intent.expires_at) > created && Date.parse(intent.expires_at) <= created + 3600000, 'PARENT_EXPIRY_INVALID');
  const artifactRoot = '/Library/Application Support/auth-service/mcp-pilot-v2/releases/' + intent.artifact_digest;
  const manifest = validateArtifact(artifactRoot, measuredManifest);
  insist(manifest.source_commit === intent.source_commit && manifest.source_tree === intent.source_tree && manifest.entrypoints.outer_launcher, 'OUTER_MANIFEST_INVALID');
  insist(equal(measurePilotOuterInputs(),manifest.build_inputs.outer_executor),'OUTER_MODULE_OR_INPUT_DRIFT');
  verifyOuterInputs(manifest,measureProducer(process.pid));
  const helper = join(artifactRoot, 'scripts/mcp-pilot-human-auth');
  for (let path = helper; path !== '/'; path = resolve(path, '..')) {
    const st = lstatSync(path); insist(!st.isSymbolicLink() && st.uid === 0 && !(st.mode & 0o022) &&
      (path !== helper || st.isFile() && st.nlink === 1 && !!(st.mode & 0o111)), 'HELPER_IDENTITY_INVALID');
  }
  insist(createHash('sha256').update(readFileSync(helper)).digest('hex') === intent.helper_digest, 'HELPER_DIGEST_MISMATCH');
  const account = spawnSync('/usr/bin/dscl', ['.', '-read', '/Users/yanfenma', 'GeneratedUID', 'UniqueID', 'PrimaryGroupID'], { encoding: 'utf8', env: { PATH: '/usr/bin:/bin' } });
  insist(account.status === 0 && account.stdout.includes('GeneratedUID: ' + intent.account.generated_uid) &&
    account.stdout.includes('UniqueID: 502') && account.stdout.includes('PrimaryGroupID: 20'), 'NATIVE_ACCOUNT_MISMATCH');
  const challenge = randomBytes(32).toString('base64url'), receiverNonce = randomBytes(32).toString('base64url'), helperNonce = randomBytes(32).toString('base64url');
  const deadline = new Date(Math.min(created + 120000, Date.parse(intent.expires_at))).toISOString();
  const child = spawn('/usr/bin/python3', ['-c', 'import os,sys; os.setgroups([20]); os.setgid(20); os.setuid(502); os.execve(sys.argv[1],[sys.argv[1]],{"PATH":"/usr/bin:/bin"})', helper],
    { stdio: ['ignore', 'ignore', 'ignore', 'pipe'], env: { PATH: '/usr/bin:/bin' } });
  let measuredHelper: Json | undefined;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { const measured = measureProducer(child.pid!); if (measured.uid === 502 && measured.gid === 20 && measured.executable === helper) { measuredHelper = measured; break; } } catch { /* exec transition is not proof */ }
    if (child.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  if (!measuredHelper || createHash('sha256').update(readFileSync(helper)).digest('hex') !== intent.helper_digest) { child.kill('SIGKILL'); throw new Refusal('HELPER_LAUNCH_PROVENANCE_INVALID'); }
  const endpoint = child.stdio[3] as import('node:net').Socket;
  const request = { kind: 'authenticate', intent, intent_digest: digest(intent), challenge_nonce: challenge,
    receiver_start_nonce: receiverNonce, helper_start_nonce: helperNonce, deadline };
  const response = await new Promise<Json>((resolve, reject) => {
    let bytes = Buffer.alloc(0); let settled = false;
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Refusal('NATIVE_AUTH_TIMEOUT')); }, Math.max(1, Date.parse(deadline) - Date.now()));
    child.once('error', () => { clearTimeout(timer); reject(new Refusal('NATIVE_AUTH_UNAVAILABLE')); });
    endpoint.on('data', data => { bytes = Buffer.concat([bytes, data]); if (bytes.length > 65540) child.kill('SIGKILL'); });
    child.once('exit', code => { clearTimeout(timer); if (settled) return; settled = true;
      try { insist(code === 0, 'NATIVE_AUTH_REFUSED'); resolve(decodeNativeFrame(bytes)); } catch (e) { reject(e); } });
    endpoint.end(nativeFrame(request));
  });
  insist(keysEqual(response, ['kind', 'intent_digest', 'challenge_nonce', 'helper_start_nonce', 'result', 'observed_at']) &&
    response.kind === 'authentication-result' && response.result === 'authenticated' && response.intent_digest === digest(intent) &&
    response.challenge_nonce === challenge && response.helper_start_nonce === helperNonce &&
    Date.parse(response.observed_at) >= created && Date.parse(response.observed_at) <= Date.parse(deadline) && Date.now() <= Date.parse(deadline), 'NATIVE_AUTH_CHAIN_INVALID');
  const authentication = { schema_version: 2, delegation_id: intent.delegation_id, intent_digest: digest(intent), challenge_nonce: challenge,
    helper_digest: intent.helper_digest, receiver_source_commit: intent.source_commit, receiver_start_nonce: receiverNonce,
    helper_pid: child.pid, helper_start_nonce: helperNonce, account: intent.account, policy: 'deviceOwnerAuthentication', reuse_seconds: 0,
    result: 'authenticated', authenticated_at: response.observed_at, deadline };
  const parent = parentSchema.parse({ ...intent, issued_at: response.observed_at, authentication_receipt_digest: digest(authentication) });
  const parentDigest = digest(parent);
  const producer = { schema_version: 2, delegation_id: parent.delegation_id, load_operation_id:preparation.loadOperationId, receiver_start_nonce: receiverNonce,
    process: measureProducer(process.pid), executable_digest: createHash('sha256').update(readFileSync(process.execPath)).digest('hex'),
    receiver_entry: realpathSync(process.argv[1]), receiver_entry_digest: createHash('sha256').update(readFileSync(process.argv[1])).digest('hex'),
    source_commit: parent.source_commit, artifact_digest: parent.artifact_digest, intent_digest: digest(intent),
    authentication_receipt_digest: digest(authentication), parent_digest: parentDigest, created_at: new Date().toISOString() };
  verifyProducer(parent, intent, authentication, producer, manifest);
  custodyCall(parent.delegation_id, 'initialize', { records: { 'intent.json': canonical(intent), 'authentication.json': canonical(authentication),
    'delegation.json': canonical(parent), 'producer.json': canonical(producer), 'artifact-manifest.json': canonical(manifest) } });
  return buildCustody(parent, intent, authentication, producer, manifest);
}
function buildCustody(parent: PilotParent, intent: Json, authentication: Json, producer: Json, manifest: Json, readonly=false): PilotCustody {
  const parentDigest = digest(parent);
  async function validate(live = true) {
    const records = custodyCall(parent.delegation_id, 'read-parent');
    insist(!live || !readonly,'READONLY_CUSTODY');
    verifyProducer(parent, intent, authentication, producer, manifest,!readonly);
    insist(records['intent.json'] === canonical(intent) && records['authentication.json'] === canonical(authentication) && records['delegation.json'] === canonical(parent) && records['producer.json'] === canonical(producer) && records['artifact-manifest.json'] === canonical(manifest), 'NATIVE_ORIGIN_CHAIN_CHANGED');
    if (live) insist(!records.revoked && Date.now() < Date.parse(parent.expires_at), 'PARENT_EXPIRED_OR_REVOKED');
  }
  async function readChild(capability: PilotCapability): Promise<PilotChildRecord> {
    capabilitySchema.parse(capability); await validate(false);
    const records = custodyCall(parent.delegation_id, 'read-child', { capability });
    const child = childSchema.parse(parseClosedJson(records['mandate.json'])), plan = parseClosedJson(records['plan.json']) as Json;
    const claim = z.object({schema_version:z.literal(2),parent_delegation_id:uuid,parent_delegation_digest:sha,capability:capabilitySchema,
      operation_id:uuid,plan_digest:sha,approval_nonce:nonceSchema,child_digest:sha,actor_ref:z.literal('01a0d846-431e-7dc0-95e2-a841cd0bff5a'),allocated_at:date,expires_at:date}).strict().parse(records.claim);
    insist(child.phase === capability && child.parent_delegation_id === parent.delegation_id && child.parent_delegation_digest === parentDigest &&
      child.source_commit === parent.source_commit && child.artifact_digest === parent.artifact_digest && child.plan_digest === plan.plan_digest &&
      claim.child_digest === digest(child) && claim.operation_id === child.operation_id && claim.capability === capability &&
      claim.parent_delegation_id === parent.delegation_id && claim.expires_at === child.expires_at && claim.parent_delegation_digest === parentDigest && claim.plan_digest === child.plan_digest && claim.approval_nonce === child.approval_nonce, 'CHILD_CHAIN_INVALID');
    const history=stages(capability);insist(history.rows[0]?.stage==='ISSUED' && history.rows[0]?.evidence_digest===digest(child),'CHILD_ISSUANCE_UNPROVEN');
    insist(equal(osCall({root:FIXED.escrow,destination:FIXED.destination,uid:FIXED.uid,gid:FIXED.gid},child,'capability-read',{capability}).value,claim),'GLOBAL_CLAIM_MISMATCH');
    return { child, plan, childDigest: digest(child), operationDirectory: join(custodyRoot, parent.delegation_id, child.operation_id) };
  }
  function stages(capability: PilotCapability) {
    const raw = custodyCall(parent.delegation_id, 'read-child', { capability })['stages.jsonl'];
    const stageSchema=z.object({schema_version:z.literal(2),parent_delegation_id:uuid,capability:capabilitySchema,stage:z.enum(['ISSUED','ATTEMPT_STARTED','COMMIT_REQUESTED','COMMITTED','OUTCOME_UNKNOWN','STOPPED','ALIGNED','RECOVERED','REFUSED']),evidence_digest:sha,previous_digest:sha,observed_at:date}).strict();
    const rows = raw.trim().split('\n').map((r: string) => stageSchema.parse(parseClosedJson(r))); let previous = parentDigest;
    for (const row of rows) { insist(row.previous_digest === previous && row.parent_delegation_id === parent.delegation_id && row.capability === capability, 'STAGE_CHAIN_INVALID'); previous = digest(row); }
    return { rows, last: previous };
  }
  async function appendStage(capability: PilotCapability, stage: string, evidenceDigest: string) {
    insist(!readonly,'READONLY_CUSTODY');
    insist(['ATTEMPT_STARTED', 'COMMIT_REQUESTED', 'COMMITTED', 'OUTCOME_UNKNOWN', 'STOPPED', 'ALIGNED', 'RECOVERED', 'REFUSED'].includes(stage), 'INVALID_CUSTODY_STAGE'); sha.parse(evidenceDigest);
    const old = stages(capability); insist(!['COMMITTED', 'OUTCOME_UNKNOWN', 'RECOVERED', 'REFUSED'].includes(old.rows.at(-1)?.stage), 'TERMINAL_STAGE_IMMUTABLE');
    const record = { schema_version: 2, parent_delegation_id: parent.delegation_id, capability, stage, evidence_digest: evidenceDigest,
      previous_digest: old.last, observed_at: new Date().toISOString() };
    custodyCall(parent.delegation_id, 'append', { capability, record: canonical(record) });
  }
  const custody: PilotCustody = { parent: Object.freeze(parent), parentDigest, producerDigest: digest(producer), producerStartNonce:producer.receiver_start_nonce, plannedLoadOperationId:producer.load_operation_id, readChild,
    async allocate(capability, plan, dependencyRecord) {
      insist(!readonly,'READONLY_CUSTODY');
      capabilitySchema.parse(capability); const lock = await parentControl(parent.delegation_id);
      try { lock.assertHeld(); await validate();
        if (capability === 'candidate-load') insist(plan.load_operation_id === custodyCall(parent.delegation_id,'read-window').load_operation_id, 'LOAD_OPERATION_RESERVATION_MISMATCH');
        const q = capability === 'candidate-load' ? { parent_delegation_id: parent.delegation_id, parent_delegation_digest: plan.parent_digest,
          source_commit: plan.source_commit, phase: capability, operation_id: plan.load_operation_id, approval_nonce: randomBytes(32).toString('base64url'),
          created_at: new Date().toISOString(), expires_at: new Date(Math.min(Date.parse(plan.deadline), Date.now()+600000, Date.parse(parent.expires_at))).toISOString() } : plan.request; insist(q && q.parent_delegation_id === parent.delegation_id && q.parent_delegation_digest === parentDigest &&
          q.source_commit === parent.source_commit && q.phase === capability && !q.approval_digest && sha.safeParse(plan.plan_digest).success &&
          (capability === 'candidate-load' ? plan.plan_digest === digest(Object.fromEntries(Object.entries(plan).filter(([k])=>k!=='plan_digest'))) && plan.artifact_digest === parent.artifact_digest :
            plan.plan_digest === planHash(q, plan.prestate, plan.classification)), 'CHILD_PLAN_INVALID');
        const prior = capability === 'candidate-load' ? 'registry-migrate-agent-v1' : capability === 'supply' ? 'candidate-load' :
          capability === 'registry-disable-migrated' ? 'registry-migrate-agent-v1' : capability === 'recover-delivery' ? 'supply' : undefined;
        if (prior) { await readChild(prior); if (capability === 'recover-delivery') { const receipt = custodyCall(parent.delegation_id,'reconciliation-read',{capability:'supply'}); insist(receipt.error_class === 'COMMITTED_DELIVERY_INCOMPLETE','RECOVERY_STATE_REFUSED'); } else insist(['COMMITTED', 'ALIGNED'].includes(stages(prior).rows.at(-1)?.stage), 'CAPABILITY_ORDER_REFUSED'); }
        const child = childSchema.parse({ schema_version: 2, parent_delegation_id: parent.delegation_id, parent_delegation_digest: parentDigest,
          phase: capability, operation_id: q.operation_id, plan_digest: plan.plan_digest, approval_nonce: q.approval_nonce,
          actor_ref: parent.executor_ref, environment: parent.environment, source_commit: parent.source_commit, artifact_digest: parent.artifact_digest,
          created_at: q.created_at, expires_at: q.expires_at, attempts_max: 1 });
        insist(Date.parse(child.created_at) <= Date.now() && Date.parse(child.expires_at) > Date.now() && Date.parse(child.expires_at) <= Date.parse(child.created_at) + 600000 &&
          Date.parse(child.expires_at) <= Date.parse(parent.expires_at), 'CHILD_EXPIRY_INVALID');
        const claim = { schema_version: 2, parent_delegation_id: parent.delegation_id, parent_delegation_digest: parentDigest, capability,
          operation_id: child.operation_id, plan_digest: child.plan_digest, approval_nonce: child.approval_nonce, child_digest: digest(child), actor_ref: parent.executor_ref,
          allocated_at: new Date().toISOString(), expires_at: child.expires_at };
        const issued = { schema_version: 2, parent_delegation_id: parent.delegation_id, capability, stage: 'ISSUED', evidence_digest: digest(child), previous_digest: parentDigest, observed_at: claim.allocated_at };
        originalCapability(custody,'capability-reserve',claim);
        custodyCall(parent.delegation_id, 'allocate', { capability, operation: child.operation_id, claim: canonical(claim), records:
          { 'mandate.json': canonical(child), 'plan.json': canonical(plan), 'stages.jsonl': canonical(issued) + '\n', 'dependencies.json': canonical(dependencyRecord ?? (capability === 'candidate-load' ? { schema_version:2, plan_digest:child.plan_digest } : custodyCall(parent.delegation_id,'read-dependencies',{operation:child.operation_id}))) } });
        return readChild(capability);
      } finally { await lock.release(); }
    },
    async admit(capability, planDigest) {
      insist(!readonly,'READONLY_CUSTODY');
      const lock = await parentControl(parent.delegation_id);
      try { await validate(); const { child } = await readChild(capability);
        insist(child.plan_digest === planDigest && Date.now() < Date.parse(child.expires_at) && stages(capability).rows.length === 1 && stages(capability).rows[0].stage === 'ISSUED', 'CHILD_ATTEMPT_SPENT');
        const claim=custodyCall(parent.delegation_id,'read-child',{capability}).claim;
        originalCapability(custody,'capability-read',claim);
        lock.assertHeld(); await appendStage(capability, 'ATTEMPT_STARTED', planDigest); return lock;
      } catch (e) { await lock.release(); throw e; }
    }, appendStage,
    async revoke(reason) { insist(!readonly,'READONLY_CUSTODY'); insist(['EXECUTOR_STOP', 'INTEGRITY_FAILURE'].includes(reason), 'INVALID_REVOKE_REASON'); const lock = await parentControl(parent.delegation_id);
      try { await validate(false); const claimNames=custodyCall(parent.delegation_id,'read-parent').claim_names as string[];
        const last=claimNames.map(name=>{insist(name.endsWith('.json') && PILOT_CAPABILITIES.includes(name.slice(0,-5) as PilotCapability),'CLAIM_NAME_INVALID');return stages(name.slice(0,-5) as PilotCapability).rows.at(-1)!;}).sort((a,b)=>a.observed_at.localeCompare(b.observed_at)).at(-1);
        custodyCall(parent.delegation_id, 'revoke', { record: canonical({ schema_version: 2, parent_delegation_id: parent.delegation_id,
        parent_delegation_digest: parentDigest, actor_ref: parent.executor_ref, reason, observed_at: new Date().toISOString(), last_stage_digest: last ? digest(last) : parentDigest }) }); }
      finally { await lock.release(); }
    },
  };
  if(readonly) readonlyCustodies.add(custody); else liveCustodies.set(parent.delegation_id, custody); return custody;
}
/** Immutable protected dependency provenance for a recorded child; never live effect admission. */
export function validateRecordedPilotDependencies(evidence:Json,parent:PilotParent,producerDigest:string,producerStartNonce:string,request:Request,recorded:PilotChildRecord):Dependencies {
  insist(keysEqual(evidence,['schema_version','parent_delegation_id','operation_id','producer_digest','dependencies','witness']) &&
    evidence.schema_version===2 && evidence.parent_delegation_id===parent.delegation_id && evidence.operation_id===request.operation_id &&
    evidence.producer_digest===producerDigest && request.parent_delegation_id===parent.delegation_id && request.parent_delegation_digest===digest(parent) &&
    equal(request,{...recorded.plan.request,approval_digest:recorded.childDigest}) && recorded.child.plan_digest===recorded.plan.plan_digest &&
    recorded.plan.plan_digest===planHash(request,recorded.plan.prestate,recorded.plan.classification),'DEPENDENCY_ORIGIN_INVALID');
  parseDependencyWitness(evidence.witness,parent,request,'stop',true);
  insist(evidence.witness.producer_start_nonce===producerStartNonce,'DEPENDENCY_ORIGIN_INVALID');
  return dependenciesSchema.parse(evidence.dependencies);
}
export function validateDependencyWitness(value: unknown, parent: PilotParent, request: Request, kind: 'stop' | 'alignment' | 'transport') {
  return parseDependencyWitness(value,parent,request,kind,false);
}
function parseDependencyWitness(value: unknown, parent: PilotParent, request: Request, kind: 'stop' | 'alignment' | 'transport', historical:boolean) {
  const witness = z.object({ schema_version: z.literal(2), parent_delegation_id: uuid, operation_id: uuid,
    kind: z.enum(['stop', 'alignment', 'transport']), original_receipt_digest: sha, producer_ref: ref, producer_start_nonce: nonceSchema,
    source_commit: git, artifact_digest: sha, projection_digest: sha, observed_at: date, valid_until: date,
    window_id: uuid, verified_unchanged: z.literal(true) }).strict().parse(value);
  const originalDigest = kind === 'stop' && request.phase !== 'supply' ? request.stop_serving_receipt_digest :
    kind === 'transport' && request.phase === 'supply' ? request.connector_config_receipt_digest : request.runtime_preimage_receipt_digest;
  insist(witness.parent_delegation_id === parent.delegation_id && witness.operation_id === request.operation_id && witness.kind === kind &&
    witness.original_receipt_digest === originalDigest && witness.producer_ref === parent.executor_ref && witness.source_commit === parent.source_commit &&
    witness.artifact_digest === parent.artifact_digest && Date.parse(witness.observed_at) <= Date.now() && (historical || Date.parse(witness.valid_until) >= Date.now()) &&
    Date.parse(witness.valid_until) <= Date.parse(witness.observed_at) + 5000 && Date.parse(witness.valid_until) <= Date.parse(parent.expires_at) &&
    Date.parse(witness.valid_until) <= Date.parse(request.expires_at), 'DEPENDENCY_WITNESS_INVALID');
  return witness;
}
/** Compare only actual newly measured time evidence; frozen projection/receipt/actor/window cannot change. */
export function validateWitnessRefresh(original:Json,fresh:Json,parent:PilotParent,request:Request):Json {
  const next=validateDependencyWitness(fresh,parent,request,request.phase==='supply'?'alignment':'stop');
  const frozen=(v:Json)=>Object.fromEntries(Object.entries(v).filter(([k])=>!['observed_at','valid_until'].includes(k)));
  insist(equal(frozen(original),frozen(next)) && Date.parse(next.observed_at)>=Date.parse(original.observed_at),'WITNESS_PROJECTION_DRIFT');
  return next;
}
export async function refreshPilotWitness(custody:PilotCustody,request:Request,measure:()=>Promise<Json>):Promise<void> {
  insist(liveCustodies.get(custody.parent.delegation_id)===custody && !readonlyCustodies.has(custody),'ORIGINAL_WINDOW_OWNER_REQUIRED');
  const window=await verifyPilotWindow(custody);window.assertHeld();
  const old=custodyCall(custody.parent.delegation_id,'read-dependencies',{operation:request.operation_id});
  insist(old.producer_digest===custody.producerDigest && old.operation_id===request.operation_id,'DEPENDENCY_ORIGIN_INVALID');
  const fresh=validateWitnessRefresh(old.witness,await measure(),custody.parent,request);
  insist(fresh.window_id===window.windowId && fresh.producer_start_nonce===custody.producerStartNonce,'WINDOW_WITNESS_MISMATCH');
  const lock=await parentControl(custody.parent.delegation_id);
  try{lock.assertHeld();window.assertHeld();custodyCall(custody.parent.delegation_id,'witness-append',{operation:request.operation_id,record:canonical(fresh)});}finally{await lock.release();}
}
export async function cli(args: string[], stdin: string): Promise<Json> {
  let q: Request | undefined;
  try {
    insist(args.length <= 2, 'INVALID_ARGUMENTS'); const phase = args[0] ?? 'supply', action = args[1] ?? 'plan';
    insist(['registry', 'registry-disable', 'registry-migrate-agent-v1', 'registry-disable-migrated', 'supply'].includes(phase) && ['plan', 'apply', 'verify', 'reconcile', 'recover-delivery'].includes(action) &&
      (action !== 'recover-delivery' || phase === 'supply'), 'INVALID_ACTION');
    const recovery = (parseClosedJson(stdin) as Json)?.phase === 'recover-delivery' ? parseRecoveryRequest(stdin) : undefined;
    if(recovery) { insist(phase==='supply' && ['plan','recover-delivery','verify','reconcile'].includes(action),'PHASE_MISMATCH'); const owner=await openPilotCustody(recovery.parent_delegation_id,['verify','reconcile'].includes(action)?'reconcile':'live'); const original=await owner.readChild('supply'); q=parseRequest(JSON.stringify({...original.plan.request,approval_digest:original.childDigest})); }
    else { q = parseRequest(stdin); insist(q.phase === phase, 'PHASE_MISMATCH'); }
    insist(q.environment === 'production', 'PRODUCTION_COORDINATES_REQUIRED');
    const readonly=['verify','reconcile'].includes(action);
    const custody = await openPilotCustody(q.parent_delegation_id,readonly?'reconcile':'live');
    const window = readonly ? undefined : await verifyPilotWindow(custody); window?.assertHeld();
    insist(custody.parentDigest === q.parent_delegation_digest, 'PARENT_REQUEST_MISMATCH');
    if(readonly){const recorded=await custody.readChild(q.phase as PilotCapability);insist(equal(q,{...recorded.plan.request,approval_digest:recorded.childDigest}),'RECONCILIATION_REQUEST_MISMATCH');}
    const loadOperation = custodyCall(custody.parent.delegation_id,'read-window').load_operation_id;
    const privateConfig = join(custodyRoot,custody.parent.delegation_id,uuid.parse(loadOperation),'preimage/service.env');
    const configStat = lstatSync(privateConfig);
    insist(configStat.isFile() && !configStat.isSymbolicLink() && configStat.nlink === 1 && configStat.uid === 0 && configStat.gid === 0 &&
      (configStat.mode & 0o777) === 0o600, 'PRIVATE_CONFIG_IDENTITY_INVALID');
    const privateManifest=parseClosedJson(custodyCall(custody.parent.delegation_id,'read-parent')['artifact-manifest.json'],64*1024*1024) as Json;
    const binding=privateManifest.private_config.find((b:Json)=>b.purpose==='service-env');
    insist(binding?.custody_ref==='preimage/service.env' && binding.mode===0o600 && ['dev','ino','uid','gid'].every(k=>binding[k]===(configStat as unknown as Json)[k]),'PRIVATE_CONFIG_MANIFEST_MISMATCH');
    const config = parseDotenv(readFileSync(privateConfig));
    insist(typeof config.DATABASE_URL === 'string', 'PRIVATE_DATABASE_BINDING_REQUIRED');
    const database = new PrismaClient({ datasources: { db: { url: config.DATABASE_URL } }, log: [] });
    const vehicle = createProductionVehicle({ environment: 'production', authorityIssuer: custody.parent.issuer, custody, database,
      mandate: async () => undefined,
      dependencies: async (request, mode) => {
        const evidence = custodyCall(custody.parent.delegation_id,'read-dependencies',{operation:request.operation_id});
        insist(keysEqual(evidence, ['schema_version', 'parent_delegation_id', 'operation_id', 'producer_digest', 'dependencies', 'witness']) &&
          evidence.schema_version === 2 && evidence.parent_delegation_id === custody.parent.delegation_id && evidence.operation_id === request.operation_id &&
          evidence.producer_digest === custody.producerDigest, 'DEPENDENCY_ORIGIN_INVALID');
        if(mode==='recorded') return validateRecordedPilotDependencies(evidence,custody.parent,custody.producerDigest,custody.producerStartNonce,request,await custody.readChild(request.phase as PilotCapability));
        const rows=custodyCall(custody.parent.delegation_id,'witness-read',{operation:request.operation_id}) as unknown as Json[];
        const witness=validateWitnessRefresh(evidence.witness,rows.at(-1)??evidence.witness,custody.parent,request);
        window?.assertHeld(); insist(witness.window_id === window?.windowId && witness.producer_start_nonce===custody.producerStartNonce, 'WINDOW_WITNESS_MISMATCH');
        return dependenciesSchema.parse(evidence.dependencies);
      } });
    try { const child = action === 'apply' ? await custody.readChild(q.phase as PilotCapability) : action==='recover-delivery' ? await custody.readChild('recover-delivery') : undefined; return await vehicle.run(recovery ? stdin : q, action as Action, child?.plan); }
    finally { await vehicle.close(); }
  } catch (e) { return validatePublicOutput(failure(q, 'admission', e instanceof Refusal ? e.category : 'UNEXPECTED_FAILURE',false,['verify','reconcile'].includes(args[1])?'OUTCOME_UNKNOWN':'REFUSED')); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await cli(process.argv.slice(2), readFileSync(0, 'utf8'));
  process.stdout.write(JSON.stringify(result) + '\n'); process.exitCode = result.result === 'REFUSED' ? 1 : 0;
}
