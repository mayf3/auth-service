/** Bounded AUTH_SERVICE_MCP_CONVERSATION_PILOT_SUPPLY_V1 source vehicle.
 * No production trust adapter is installed. CLI input cannot configure one.
 * The import-only isolated seam uses the identical DB/OS engine, never production paths.
 * PostgreSQL and private file persistence are deliberately separate boundaries.
 */
import { z } from 'zod';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, realpathSync, lstatSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { generateClientSecret, hashClientSecret, verifyClientSecret } from '../src/lib/oauth/secret.js';

export const FIXED = Object.freeze({
  externalRef: 'dot-read-mcp-native-conversation-pilot-v1', displayName: 'dot native conversation pilot v1',
  resource: 'agent-core-mcp-conversation-v1', scope: 'conversation.access',
  communicationScope: 'mcp-native-conversation-pilot-v1',
  destination: '/Users/yanfenma/.config/read-mcp/native-conversation.client.json',
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
const common = { schema_version: z.literal(1), operation_id: z.string().uuid(), environment: ref,
  source_commit: git, spec_ref: ref, spec_digest: sha, audience_authority_ref: ref, audience_authority_digest: sha,
  bundle_digest: sha, runtime_digest: sha, runtime_preimage_receipt_ref: ref, runtime_preimage_receipt_digest: sha,
  operator_ref: ref, approval_ref: ref, approval_digest: sha, approval_nonce: z.string().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/),
  created_at: z.string().datetime(), expires_at: z.string().datetime() };
const registry = { stop_serving_receipt_ref: ref, stop_serving_receipt_digest: sha };
const requestSchema = z.discriminatedUnion('phase', [
  z.object({ ...common, phase: z.literal('registry'), ...registry }).strict(),
  z.object({ ...common, phase: z.literal('registry-disable'), ...registry }).strict(),
  z.object({ ...common, phase: z.literal('supply'), connector_config_receipt_ref: ref,
    connector_config_receipt_digest: sha, connector_subject: z.string().uuid(), registry_receipt_ref: ref,
    registry_receipt_digest: sha }).strict(),
]);
export type Request = z.infer<typeof requestSchema>;
export type Action = 'plan' | 'apply' | 'verify' | 'reconcile' | 'recover-delivery';
type Json = Record<string, any>;
class Refusal extends Error { constructor(public readonly category: string) { super(category); } }
function insist(ok: unknown, category: string): asserts ok { if (!ok) throw new Refusal(category); }

// A recursive JSON recognizer rejects duplicate decoded keys at every nesting level.
export function parseClosedJson(raw: string): unknown {
  insist(Buffer.byteLength(raw) <= 1024 * 1024, 'INPUT_TOO_LARGE');
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
      insist(m, 'INVALID_JSON'); p += m[0].length; } };
  try { value(); ws(); insist(p === raw.length, 'INVALID_JSON'); return JSON.parse(raw); }
  catch (e) { if (e instanceof Refusal) throw e; throw new Refusal('INVALID_JSON'); }
}
export function parseRequest(raw: string): Request { try { return requestSchema.parse(parseClosedJson(raw)); }
  catch (e) { if (e instanceof Refusal) throw e; throw new Refusal('INVALID_REQUEST'); } }
export function canonical(value: any): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export function digest(value: unknown): string { const data = canonical(value); return createHash('sha256').update(String(Buffer.byteLength(data)) + ':' + data).digest('hex'); }
function equal(a: unknown, b: unknown) { return canonical(a) === canonical(b); }
function keysEqual(value: Json, keys: string[]) { return equal(Object.keys(value).sort(), keys.sort()); }
function failure(q: Request | undefined, stage: string, category: string, fenced = false, result = 'REFUSED'): Json {
  return { schema_version: 1, result, operation_id: q?.operation_id ?? { state: 'unknown' },
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
const planSchema = z.object({ schema_version: z.literal(1), phase: z.enum(['registry', 'registry-disable', 'supply']), result: z.literal('PLAN'),
  request: requestSchema, plan_digest: sha, prestate_digest: sha, prestate: stateProjection,
  classification: z.enum(['ABSENT_APPLY', 'DISABLE_APPLY', 'EXACT_RERUN_NOOP', 'REFUSED']),
  intended_effect: z.union([registryCounts, supplyCounts.extend({ audience: z.literal(0) }).strict()]),
  approval_nonce: common.approval_nonce, observed_at: date, expires_at: date, native_product_disabled: z.literal(true),
  live_credential_acceptance: z.literal('NOT_RUN'), filesystem_observation: z.literal('separate_non_atomic') }).strict();
const residual = z.union([
  z.object({ state: z.literal('unobserved') }).strict(),
  z.object({ state: z.enum(['fenced', 'proven_not_committed']), operation_id: uuid }).strict(),
  z.object({ state: z.enum(['committed_delivery_incomplete', 'secret_lost']), operation_id: uuid, audit_id: uuid }).strict(),
]);
const unknown = z.object({ state: z.literal('unknown') }).strict();
const failureSchema = z.object({ schema_version: z.literal(1), result: z.enum(['REFUSED', 'ROLLED_BACK', 'OUTCOME_UNKNOWN', 'SECRET_LOST', 'ROLLBACK_INCOMPLETE']),
  operation_id: z.union([uuid, unknown]), environment: z.union([ref, unknown]), stage: z.string().regex(/^[A-Za-z_-]{1,64}$/),
  error_class: z.string().regex(/^[A-Z_0-9]{1,80}$/), residual_coordinates: residual,
  retryable: z.literal(false), fence_preserved: z.boolean(), observed_at: date }).strict();
const productSchema = z.object(Object.fromEntries(Object.entries(PRODUCT).map(([key, value]) => [key, z.literal(value)]))).strict();
const supplyReceiptSchema = z.object({ schema_version: z.literal(1), phase: z.literal('supply'), result: z.enum(['COMMITTED', 'EXACT_RERUN_NOOP']),
  operation_id: uuid, environment: ref, operator_ref: ref, approval_ref: ref, approval_digest: sha, approval_nonce: common.approval_nonce,
  source_commit: git, spec_ref: ref, spec_digest: sha, plan_digest: sha, prestate_digest: sha, poststate_digest: sha, audit_id: uuid,
  principal_id: uuid, principal_type: z.literal('service'), principal_external_ref: z.literal(FIXED.externalRef), client_row_id: uuid,
  client_id: z.string().regex(/^mc_[A-Za-z0-9_-]{24}$/), client_external_ref: z.literal(FIXED.externalRef), resource: z.literal(FIXED.resource),
  scope: z.literal(FIXED.scope), grant_version: z.literal(1), connector_subject: uuid, connector_config_receipt_ref: ref,
  connector_config_receipt_digest: sha, communication_scope_id: z.literal(FIXED.communicationScope), product_context: productSchema,
  credential_delivery: z.object({ path: z.string(), uid: z.literal(502), gid: z.literal(20), mode: z.literal('0600'), regular: z.literal(true),
    nonsymlink: z.literal(true), secret_matches_verifier: z.literal(true) }).strict(), effect_counts: supplyCounts,
  non_target_digest_before: sha, non_target_digest_after: sha, committed_at: date, verified_at: date }).strict();
const registryReceiptSchema = z.object({ ...common, phase: z.enum(['registry', 'registry-disable']), ...registry,
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
  result={'destination':dst,'fences':[], 'parent_identity':parent_identity, 'escrow_identity':escrow_identity,
   'ancestor_identities':[list(pin[2:]) for pin in pins]}
  for n in sorted(os.listdir(r)):
   if n.startswith('attempt-') and n.endswith('.jsonl'):
    raw=private_read(r,n).decode(); records=[json.loads(v) for v in raw.splitlines()]
    result['fences'].append(records)
  if result['destination']['state']=='present' and result['destination']['gid']!=gid: result['destination']={'state':'unsafe'}
 elif cmd=='hold-lock':
  # Permanent inode, never unlinked: every legitimate apply/recovery locks this same inode.
  lockfd=os.open('operation.lock',os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600,dir_fd=r); fds.append(lockfd)
  s=os.fstat(lockfd); check(s,0,0o600,True)
  fcntl.flock(lockfd,fcntl.LOCK_EX|fcntl.LOCK_NB)
  t=os.stat('operation.lock',dir_fd=r,follow_symlinks=False)
  if (s.st_dev,s.st_ino)!=(t.st_dev,t.st_ino): raise Exception('INODE_SWAP')
  os.fsync(lockfd); os.fsync(r); stable()
  print(json.dumps({'ok':True,'value':{'held':True,'dev':s.st_dev,'ino':s.st_ino}}),flush=True)
  # Parent owns the write end. Parent death closes it and releases the kernel lock.
  sys.stdin.readline()
 elif cmd=='claim':
  # Nonce files and per-operation fences remain forever. No stale-lock deletion or fence reset.
  write_new(r,'attempt-'+op+'.jsonl',json.dumps(x['record'])+'\n')
  write_new(r,'nonce-'+x['nonce'],json.dumps(x['record']))
 elif cmd=='recovery-claim':
  write_new(r,'recovery-nonce-'+x['nonce'],json.dumps(x['record']))
 elif cmd=='append':
  n='attempt-'+op+'.jsonl'; f=os.open(n,os.O_WRONLY|os.O_APPEND|os.O_NOFOLLOW,dir_fd=r)
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
 allowed={'METADATA','FILE_IDENTITY','ANCESTOR_MODE','ANCESTOR_OWNER','INODE_SWAP','FILE_SIZE','FILESYSTEM','LOCK_IDENTITY','DESTINATION_EXISTS','INJECTED','COMMAND','ESCROW_INTEGRITY'}
 category=str(failure) if str(failure) in allowed else 'ERRNO_'+str(getattr(failure,'errno',0) or 0)
 print(json.dumps({'ok':False,'error_class':category})); sys.exit(1)
finally:
 for f in reversed(fds):
  try: os.close(f)
  except: pass
`;

type Coordinates = { root: string; destination: string; uid: number; gid: number };
function osCall(c: Coordinates, q: Request, cmd: string, extra: Json = {}): { value: Json; private: Buffer } {
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
async function acquireOsLock(c: Coordinates, q: Request) {
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
  return { assertHeld() { insist(held && !exited && !diagnostic, 'OS_LOCK_LOST'); },
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
export interface Mandate {
  issuer: string; actor: string; environment: string;
  operation_id: string; approval_ref: string; approval_digest: string; approval_nonce: string;
  plan_digest: string; action: 'apply' | 'recover-delivery'; expires_at: string; attempts_max: 1; recovery_nonce?: string;
}
export interface IsolatedOptions {
  root: string; databaseUrl: string; uid: 502; gid: 20;
  dependencies: (q: Request) => Promise<Dependencies>;
  mandate: (q: Request, action: 'apply' | 'recover-delivery', planDigest: string) => Promise<Mandate | undefined>;
  fault?: (stage: string) => void | Promise<void>;
  osFault?: string | (() => string | undefined);
  lockTimeoutMs?: number;
}
type Snapshot = { audiences: any[]; principals: any[]; clients: any[]; grants: any[]; security: any[]; audits: any[] };
type Tx = Prisma.TransactionClient;
const migration = (q: Request) => 'mcp-conversation-pilot-v1:' + q.operation_id;
function publicClient(row: any) { if (!row) return { state: 'absent' }; const { secretHash, ...safe } = row; return { state: 'present', ...safe }; }
function tagged(row: any) { return row ? { state: 'present', ...row } : { state: 'absent' }; }
function audienceExpected(disabled: boolean) { return { ...AUDIENCE, ...(disabled ? { status: 'disabled', freezeReady: false, version: 2 } : {}) }; }
function audienceExact(row: any, disabled: boolean) {
  if (!row) return false; const { createdAt, updatedAt, ...value } = row; return equal(value, audienceExpected(disabled));
}
function auditDetails(q: Request, plan: Json, before: Json, after: Json, nonTarget: string): Json {
  const out: Json = { operation_id: q.operation_id, migration_id: migration(q), source_git_commit: q.source_commit,
    spec_ref: q.spec_ref, spec_digest: q.spec_digest, audience_authority_ref: q.audience_authority_ref,
    audience_authority_digest: q.audience_authority_digest, operator_ref: q.operator_ref, approval_ref: q.approval_ref,
    approval_digest: q.approval_digest, approval_nonce: q.approval_nonce, phase: q.phase, plan_digest: plan.plan_digest,
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
  const c = { root: join(root, 'escrow'), destination: join(root, 'mcp', 'native-conversation.client.json'), uid: o.uid, gid: o.gid };
  const db = new PrismaClient({ datasources: { db: { url: o.databaseUrl } }, log: [] });
  return createVehicle({ ...o, environment: 'isolated-conformance', authorityIssuer: 'isolated-independent-owner' }, c, db);
}

/** A code-level trust seam for the original owning executor. No provider is supplied
 * by this source release. JSON, argv, environment, root status or admin credentials
 * cannot create one. It must independently check the original authenticated Owner
 * mandate and protected source/runtime/stop/alignment/transport receipts. */
export interface ProductionTrustedProvider {
  environment: 'production'; authorityIssuer: string; database: PrismaClient;
  dependencies: IsolatedOptions['dependencies']; mandate: IsolatedOptions['mandate'];
}
export function createProductionVehicle(provider?: ProductionTrustedProvider) {
  insist(provider && provider.environment === 'production' && ref.safeParse(provider.authorityIssuer).success &&
    typeof provider.dependencies === 'function' && typeof provider.mandate === 'function' &&
    provider.database instanceof PrismaClient, 'TRUST_ADAPTER_UNAVAILABLE');
  insist(process.getuid?.() === 0, 'OS_ACTOR_REQUIRED');
  return createVehicle(provider, { root: FIXED.escrow, destination: FIXED.destination, uid: FIXED.uid, gid: FIXED.gid }, provider.database);
}
type EngineOptions = Pick<IsolatedOptions, 'dependencies' | 'mandate' | 'fault' | 'osFault' | 'lockTimeoutMs'> & { environment: string; authorityIssuer: string };
function createVehicle(o: EngineOptions, c: Coordinates, db: PrismaClient) {
  const fault = async (stage: string) => { await o.fault?.(stage); };
  const osFault = () => typeof o.osFault === 'function' ? o.osFault() : o.osFault;
  async function dependencies(q: Request) {
    const d = await o.dependencies(q);
    const pins = ['environment', 'source_commit', 'spec_ref', 'spec_digest', 'audience_authority_ref',
      'audience_authority_digest', 'bundle_digest', 'runtime_digest', 'runtime_preimage_receipt_ref',
      'runtime_preimage_receipt_digest', 'operator_ref'] as const;
    insist(pins.every(k => d[k] === q[k]) && d.environment === o.environment && d.executor_uid === c.uid &&
      d.executor_gid === c.gid && d.candidate_validated && d.native_product_disabled, 'DEPENDENCY_PIN_MISMATCH');
    if (q.phase === 'supply') insist(d.original_transport_verified && d.loaded_candidate_db_aligned &&
      ['connector_config_receipt_ref', 'connector_config_receipt_digest', 'connector_subject', 'registry_receipt_ref', 'registry_receipt_digest']
        .every(k => d[k as keyof Dependencies] === q[k as keyof Request]), 'PHASE_B_ALIGNMENT_REQUIRED');
    else insist(d.stopped_original_service && d.stop_serving_receipt_ref === q.stop_serving_receipt_ref &&
      d.stop_serving_receipt_digest === q.stop_serving_receipt_digest, 'STOP_SERVING_RECEIPT_REQUIRED');
  }
  async function authorize(q: Request, action: 'apply' | 'recover-delivery', pd: string) {
    const m = await o.mandate(q, action, pd);
    insist(m && m.issuer === o.authorityIssuer && m.actor === q.operator_ref && m.environment === q.environment &&
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
    return sha.safeParse(details?.plan_digest).success && sha.safeParse(details?.non_target_digest_before).success && equal(details, expected);
  }
  function classify(s: Snapshot, q: Request): 'ABSENT_APPLY' | 'DISABLE_APPLY' | 'EXACT_RERUN_NOOP' | 'REFUSED' {
    const t = target(s, q);
    if (q.phase !== 'supply') {
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
    if (!audienceExact(t.a, false)) return 'REFUSED';
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
    return { schema_version: 1, phase: q.phase, result: 'PLAN', request: q, plan_digest: digest({ request: q, prestate: state, classification }),
      prestate_digest: digest(state), prestate: state, classification,
      intended_effect: q.phase === 'supply' ? { principal: 1, client: 1, grant: 1, audit: 1, audience: 0 } :
        { principal: 0, client: 0, grant: 0, audit: 1, audience: 1, credential: 0 },
      approval_nonce: q.approval_nonce, observed_at: new Date().toISOString(), expires_at: q.expires_at,
      native_product_disabled: true, live_credential_acceptance: 'NOT_RUN', filesystem_observation: 'separate_non_atomic' };
  }
  function validatePlan(p: Json | undefined, q: Request): asserts p is Json {
    insist(p && keysEqual(p, ['schema_version', 'phase', 'result', 'request', 'plan_digest', 'prestate_digest', 'prestate', 'classification',
      'intended_effect', 'approval_nonce', 'observed_at', 'expires_at', 'native_product_disabled', 'live_credential_acceptance', 'filesystem_observation']) &&
      equal(p.request, q) && p.result === 'PLAN' && p.schema_version === 1 && p.phase === q.phase && p.approval_nonce === q.approval_nonce &&
      p.prestate_digest === digest(p.prestate) && p.plan_digest === digest({ request: q, prestate: p.prestate, classification: p.classification }), 'PLAN_INVALID');
    insist(p.expires_at === q.expires_at && Date.parse(p.expires_at) > Date.now(), 'PLAN_EXPIRED');
  }
  function fenceRecord(q: Request, p: Json, stage: string): Json { return { stage, operation_id: q.operation_id,
    approval_nonce: q.approval_nonce, plan_digest: p.plan_digest, operator_ref: q.operator_ref,
    request_digest: digest(q), external_ref: FIXED.externalRef, prestate_digest: p.prestate_digest,
    observed_at: new Date().toISOString() }; }
  function append(q: Request, p: Json, stage: string, extra: Json = {}) { osCall(c, q, 'append', { record: { ...fenceRecord(q, p, stage), ...extra }, fault: osFault() }); }
  function pinnedCredential(q: Request, fs: Json, escrow: boolean): CredentialObservation {
    const rows = (fs.fences as Json[][]).find(v => v[0]?.operation_id === q.operation_id);
    const expected = rows?.filter(v => v.stage === (escrow ? 'ESCROW_DURABLE' : 'DESTINATION_DURABLE') || (!escrow && v.stage === 'RECOVERED')).at(-1)?.file_identity;
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
    return { schema_version: 1, phase: 'supply', result: noop ? 'EXACT_RERUN_NOOP' : 'COMMITTED', operation_id: q.operation_id,
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
    await dependencies(q); const fs = fileState(c, q);
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
    await dependencies(q); validatePlan(supplied, q); let lease: Awaited<ReturnType<typeof acquireOsLock>> | undefined; let fenced = false, stage = 'admission', commitRequested = false;
    try {
      // Read-only exact NOOP may not create even an operation lock.
      const observed = await observe(q, 'verify');
      if (action === 'apply' && observed.result === 'EXACT_RERUN_NOOP') return observed;
      const authority = await authorize(q, action, supplied.plan_digest);
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
      lease = await acquireOsLock(c, q); lease.assertHeld();
      let committedSnapshot: Snapshot | undefined;
      await locked(q, true, async tx => {
        lease!.assertHeld(); stage = 'locked-prestate';
        await dependencies(q); const fs = fileState(c, q), s = await snapshot(tx), p = makePlan(q, s, fs);
        insist(p.plan_digest === supplied.plan_digest && p.prestate_digest === supplied.prestate_digest, 'STALE_PLAN');
        insist(['ABSENT_APPLY', 'DISABLE_APPLY'].includes(p.classification), 'STATE_CONFLICT');
        insist(!activeFences(fs).length, 'UNRESOLVED_ATTEMPT');
        if (q.phase === 'supply') insist(fs.destination.state === 'absent', 'DESTINATION_NOT_ABSENT');
        stage = 'claim'; fenced = true; osCall(c, q, 'claim', { nonce: q.approval_nonce, record: fenceRecord(q, p, 'ATTEMPT_STARTED'), fault: osFault() });
        await fault('ATTEMPT_STARTED'); const beforeDigest = nonTarget(s, q);
        let audit: any;
        if (q.phase !== 'supply') {
          stage = 'registry-write'; const before = tagged(target(s, q).a);
          const row = q.phase === 'registry' ? await tx.authAudience.create({ data: { ...AUDIENCE, acceptedPrincipalTypes: ['service'], registeredScopes: [FIXED.scope] } }) :
            (await tx.authAudience.updateMany({ where: { audienceId: FIXED.resource, status: 'active', version: 1, freezeReady: true },
              data: { status: 'disabled', freezeReady: false, version: 2 } }), await tx.authAudience.findUniqueOrThrow({ where: { audienceId: FIXED.resource } }));
          await fault('registry-row');
          const details = auditDetails(q, p, before, tagged(row), beforeDigest);
          audit = await tx.authSecurityAudit.create({ data: { eventType: q.phase === 'registry' ? 'audience.registry_reconciled' : 'audience.registry_disabled',
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
      return receipt(q, post, supplied, false, fileState(c, q));
    } catch (e) {
      const category = e instanceof Refusal ? e.category : 'DB_OR_PROCESS_FAILURE';
      // No unproven rollback or absence claim. Escrow/final material and tombstones persist.
      return failure(q, stage, category, fenced, fenced || commitRequested ? 'OUTCOME_UNKNOWN' : 'REFUSED');
    } finally { if (lease) await lease.release(); }
  }
  return {
    coordinates: Object.freeze({ ...c }),
    async run(raw: string | Request, action: Action = 'plan', plan?: Json): Promise<Json> {
      let q: Request | undefined;
      try { q = parseRequest(typeof raw === 'string' ? raw : JSON.stringify(raw));
        insist(['plan', 'apply', 'verify', 'reconcile', 'recover-delivery'].includes(action) &&
          (action !== 'recover-delivery' || q.phase === 'supply'), 'INVALID_ACTION');
        const result = action === 'apply' || action === 'recover-delivery' ? await mutate(q, action, plan) : await observe(q, action);
        return validatePublicOutput(result);
      } catch (e) { return validatePublicOutput(failure(q, 'admission', e instanceof Refusal ? e.category : 'DB_OR_PROCESS_FAILURE',
        !!q && (action === 'apply' || action === 'recover-delivery') && e instanceof Refusal && e.category === 'OUTPUT_SCHEMA_INVALID',
        e instanceof Refusal && e.category === 'OUTPUT_SCHEMA_INVALID' && (action === 'apply' || action === 'recover-delivery') ? 'OUTCOME_UNKNOWN' : 'REFUSED')); }
    },
    close: () => db.$disconnect(),
  };
}

export async function cli(args: string[], stdin: string): Promise<Json> {
  let q: Request | undefined;
  try {
    insist(args.length <= 2, 'INVALID_ARGUMENTS'); const phase = args[0] ?? 'supply', action = args[1] ?? 'plan';
    insist(['registry', 'registry-disable', 'supply'].includes(phase) && ['plan', 'apply', 'verify', 'reconcile', 'recover-delivery'].includes(action) &&
      (action !== 'recover-delivery' || phase === 'supply'), 'INVALID_ACTION');
    q = parseRequest(stdin); insist(q.phase === phase, 'PHASE_MISMATCH');
    // No production provider exists. In particular DATABASE_URL, sudo/root and caller JSON confer no approval.
    throw new Refusal('TRUST_ADAPTER_UNAVAILABLE');
  } catch (e) { return validatePublicOutput(failure(q, 'admission', e instanceof Refusal ? e.category : 'UNEXPECTED_FAILURE')); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await cli(process.argv.slice(2), readFileSync(0, 'utf8'));
  process.stdout.write(JSON.stringify(result) + '\n'); process.exitCode = result.result === 'REFUSED' ? 1 : 0;
}
