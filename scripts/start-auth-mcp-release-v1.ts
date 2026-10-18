/** AUTH_SERVICE_MCP_CANDIDATE_RELEASE_V1. One bounded load, no restart path.
 * No static import of env, contract, server or Prisma: pre-listen imports are explicit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { Socket } from 'node:net';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { z } from 'zod';
import dotenv from 'dotenv';

const LIMIT = 65536;
let isolatedBoundary: string | undefined;
const sha = z.string().regex(/^[0-9a-f]{64}$/);
const git = z.string().regex(/^[0-9a-f]{40}$/);
const uuid = z.string().uuid().refine(v => v === v.toLowerCase());
const stamp = z.string().regex(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/).refine(v => Number.isFinite(Date.parse(v)));
const integer = z.number().int().nonnegative().safe();
const nonce = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const nonempty = z.string().min(1);
const record = z.record(z.unknown());
const fail = (code: string): never => { throw new Error(code); };
export function canonical(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0)) return String(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k])).join(',') + '}';
  return fail('NON_CANONICAL_VALUE');
}
export const digest = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
const bytesDigest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
export function encodeFrame(value: unknown): Buffer {
  const body = Buffer.from(canonical(value)); if (body.length > LIMIT || !body.length) fail('FRAME_SIZE');
  const prefix = Buffer.alloc(4); prefix.writeUInt32BE(body.length); return Buffer.concat([prefix, body]);
}
export function decodeFrame(frame: Buffer): unknown {
  if (frame.length < 4 || frame.readUInt32BE() > LIMIT || frame.readUInt32BE() < 1 || frame.length !== frame.readUInt32BE() + 4) fail('FRAME_LENGTH');
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(frame.subarray(4));
  const value: unknown = JSON.parse(raw); if (canonical(value) !== raw) fail('FRAME_NON_CANONICAL'); return value;
}
const generationSchema = z.object({ pid: integer.positive(), start_nonce: nonce, start_time: nonempty, uid: integer, gid: integer, executable_digest: sha }).strict();
const payloadSchemas = {
  LOAD_CHALLENGE: z.object({ release_plan_digest: sha, artifact_digest: sha, expected_mode: z.literal('v1'), cwd: nonempty, env_custody_digest: sha, contract_module_url: nonempty, env_module_url: nonempty, server_module_url: nonempty, deadline: stamp }).strict(),
  LOADED: z.object({ release_plan_digest: sha, artifact_digest: sha, mode: z.literal('v1'), cwd: nonempty, env_custody_digest: sha, contract_module_url: nonempty, env_module_url: nonempty, server_module_url: nonempty, contract_identity: record, runtime_payload: record, no_listen_yet: z.literal(true) }).strict(),
  VERIFY_CHALLENGE: z.object({ release_plan_digest: sha, loaded_digest: sha, old_loaded_projection: record, candidate_loaded_projection: record, read_set: z.array(nonempty), phase_a_receipt_digest: sha, window_digest: sha, deadline: stamp }).strict(),
  ALIGNED: z.object({ release_plan_digest: sha, loaded_digest: sha, registry_diff: z.array(record), db_projection: z.array(record), db_snapshot_identity: nonempty, migration_audit_projection: record, phase_a_receipt_digest: sha, window_digest: sha, observed_at: stamp, result: z.literal('ALIGNED') }).strict(),
  RESUME: z.object({ release_plan_digest: sha, loaded_digest: sha, alignment_digest: sha, window_digest: sha, mode: z.literal('v1'), contract_module_url: nonempty, server_module_url: nonempty, runtime_digest: sha, db_projection_digest: sha, phase_a_receipt_digest: sha, resume_nonce: nonce, issued_at: stamp, expires_at: stamp }).strict(),
  FAILED: z.object({ stage: nonempty, error_code: nonempty, last_valid_message_digest: sha }).strict(),
};
type MessageType = keyof typeof payloadSchemas;
const messageSchema = z.object({ schema_version: z.literal(1), type: z.enum(['LOAD_CHALLENGE', 'LOADED', 'VERIFY_CHALLENGE', 'ALIGNED', 'RESUME', 'FAILED']), parent_digest: sha, child_digest: sha, operation_id: uuid, attempt_id: uuid, process_generation: generationSchema, challenge_nonce: nonce, sent_at: stamp, payload: record }).strict();
type Message = z.infer<typeof messageSchema>;
export function parseMessage(value: unknown): Message {
  const m = messageSchema.parse(value); payloadSchemas[m.type].parse(m.payload); return m;
}
export class PrivateChannel {
  private buffer = Buffer.alloc(0);
  private waiting?: { resolve: (m: Message) => void; reject: (e: Error) => void; timer: NodeJS.Timeout };
  private pending?: Message;
  private dead = false;
  private finished = false;
  rejectFurtherMessages() { this.finished = true; if (this.pending || this.buffer.length) this.abort(); }
  constructor(readonly socket: Socket, private readonly lost: () => void) {
    socket.on('data', data => {
      try {
        if (this.finished) fail('UNEXPECTED_FRAME');
        this.buffer = Buffer.concat([this.buffer, data]);
        if (this.buffer.length > LIMIT + 4 || (this.buffer.length >= 4 && (this.buffer.readUInt32BE() < 1 || this.buffer.readUInt32BE() > LIMIT))) fail('FRAME_SIZE');
        if (this.buffer.length >= 4 && this.buffer.length >= this.buffer.readUInt32BE() + 4) {
          const m = parseMessage(decodeFrame(this.buffer)); this.buffer = Buffer.alloc(0);
          if (this.waiting) { const w = this.waiting; this.waiting = undefined; clearTimeout(w.timer); w.resolve(m); }
          else if (!this.pending) this.pending = m; else fail('UNEXPECTED_FRAME');
        }
      } catch { this.abort(); }
    });
    socket.on('end', () => this.abort()); socket.on('error', () => this.abort()); socket.on('close', () => this.abort());
  }
  private abort() { if (this.dead) return; this.dead = true; if (this.waiting) { clearTimeout(this.waiting.timer); this.waiting.reject(new Error('CONTROL_EOF_OR_INVALID')); this.waiting = undefined; } this.lost(); }
  receive(deadline: number): Promise<Message> {
    if (this.dead || deadline <= Date.now()) return Promise.reject(new Error('CONTROL_EXPIRED'));
    if (this.pending) { const m = this.pending; this.pending = undefined; return Promise.resolve(m); }
    if (this.waiting) return Promise.reject(new Error('CONCURRENT_READ'));
    return new Promise((resolve, reject) => { const timer = setTimeout(() => { this.waiting = undefined; reject(new Error('CONTROL_TIMEOUT')); this.abort(); }, deadline - Date.now()); this.waiting = { resolve, reject, timer }; });
  }
  send(m: Message) { if (this.dead) fail('CONTROL_CLOSED'); this.socket.write(encodeFrame(parseMessage(m))); }
}
export function irreversibleDrop(uid: number, gid: number): void {
  if (!uid || !gid || process.getuid?.() !== 0 || !process.setgroups || !process.setgid || !process.setuid) fail('DROP_UNAVAILABLE');
  process.setgroups!([]); process.setgid!(gid); process.setuid!(uid);
  if (process.getuid?.() !== uid || process.geteuid?.() !== uid || process.getgid?.() !== gid || process.getegid?.() !== gid || process.getgroups?.().some(g => g !== gid)) fail('DROP_IDENTITY');
  // setuid/setgid must have discarded saved privilege as well as effective IDs.
  for (const regain of [() => process.setuid!(0), () => process.setgid!(0), () => process.setgroups!([0])]) {
    let denied = false; try { regain(); } catch (e) { denied = (e as NodeJS.ErrnoException).code === 'EPERM'; }
    if (!denied) fail('DROP_REGAIN_POSSIBLE');
  }
}
const privateBinding = z.object({ custody_ref: nonempty, dev: integer, ino: integer, uid: integer, gid: integer, mode: integer, purpose: z.enum(['service-env', 'private-key']) }).strict();
const fileEntry = z.object({ path: nonempty, kind: z.enum(['file', 'directory', 'symlink']), mode: integer, size: integer, sha256: sha, target: z.string().optional(), resolved_content_identity: sha.optional() }).strict();
const manifestSchema = z.object({ schema_version: z.literal(1), source_commit: git, source_tree: git, authority_pins: record, toolchain: record, build_inputs: record, files: z.array(fileEntry), overlay_dispositions: z.array(record), entrypoints: z.object({ node: nonempty, wrapper: z.literal('dist/scripts/start-auth-mcp-release-v1.js'), env: z.literal('dist/src/config/env.js'), contract: z.literal('dist/src/lib/oauth/v1/contract.js'), server: z.literal('dist/src/server.js'), outer_launcher: nonempty.optional() }).strict(), generated_identity: record, artifact_digest: sha, private_config: z.array(privateBinding) }).strict();
export type Manifest = z.infer<typeof manifestSchema>;
function safePath(root: string, relative: string): string {
  if (relative.includes('\0') || path.isAbsolute(relative) || relative.split('/').some(p => !p || p === '.' || p === '..')) fail('ARTIFACT_PATH');
  const result = path.join(root, relative); if (!result.startsWith(root + '/')) fail('ARTIFACT_PATH'); return result;
}
function secureAncestors(p: string, mode?: number) {
  if (fs.realpathSync(p) !== p) fail('CUSTODY_ALIAS');
  for (let current = p;; current = path.dirname(current)) {
    const s = fs.lstatSync(current); if (s.uid !== 0 || s.gid !== 0 || (s.mode & 0o022) || s.isSymbolicLink()) fail('UNPROTECTED_ANCESTOR');
    if (current === p && mode !== undefined && (s.mode & 0o777) !== mode) fail('CUSTODY_MODE');
    if (current === '/' || current === isolatedBoundary) break;
  }
}
export function validateArtifact(root: string, value: unknown, protectedInstall = true): Manifest {
  const m = manifestSchema.parse(value); const { artifact_digest, ...rest } = m;
  if (digest(rest) !== artifact_digest) fail('ARTIFACT_DIGEST');
  if (fs.realpathSync(root) !== root) fail('ARTIFACT_ALIAS');
  if (protectedInstall) secureAncestors(root, 0o755);
  const seen = new Set<string>();
  for (const entry of m.files) {
    const p = safePath(root, entry.path); if (seen.has(entry.path)) fail('ARTIFACT_DUPLICATE'); seen.add(entry.path);
    const s = fs.lstatSync(p); if ((s.mode & 0o777) !== entry.mode || s.size !== entry.size || (entry.kind !== 'symlink' && (s.mode & 0o022)) || (protectedInstall && (s.uid !== 0 || s.gid !== 0))) fail('ARTIFACT_METADATA');
    if (entry.kind === 'directory') { if (!s.isDirectory() || entry.sha256 !== bytesDigest('') || entry.target !== undefined) fail('ARTIFACT_DIRECTORY'); }
    else if (entry.kind === 'file') { if (!s.isFile() || s.nlink !== 1 || entry.target !== undefined || bytesDigest(fs.readFileSync(p)) !== entry.sha256) fail('ARTIFACT_FILE'); }
    else {
      if (!s.isSymbolicLink() || fs.readlinkSync(p) !== entry.target) fail('ARTIFACT_LINK');
      const resolved = fs.realpathSync(p), targetStat = fs.statSync(resolved);
      if (!resolved.startsWith(root + '/') || p.startsWith(resolved + '/') || (targetStat.mode & 0o022) || (protectedInstall && (targetStat.uid !== 0 || targetStat.gid !== 0))) fail('ARTIFACT_EXTERNAL_LINK');
      const targetIdentity = targetStat.isFile() ? bytesDigest(fs.readFileSync(resolved)) : targetStat.isDirectory() ? digest(m.files.filter(f => f.path.startsWith(path.relative(root, resolved) + '/'))) : fail('ARTIFACT_LINK_KIND');
      if (bytesDigest(fs.readlinkSync(p)) !== entry.sha256 || targetIdentity !== entry.resolved_content_identity) fail('ARTIFACT_LINK_IDENTITY');
    }
  }
  const walk = (dir: string) => { for (const name of fs.readdirSync(dir)) { if (/^\.env(?:\.|$)/.test(name)) fail('ARTIFACT_DOTENV'); const p = path.join(dir, name), rel = path.relative(root, p); if (!seen.has(rel)) fail('ARTIFACT_UNENUMERATED'); if (fs.lstatSync(p).isDirectory()) walk(p); } }; walk(root);
  for (const p of Object.values(m.entrypoints)) if (p !== undefined && !seen.has(p)) fail('ARTIFACT_ENTRYPOINT_MISSING');
  if (!seen.has('package-lock.json') || !seen.has('generated/minimal-auth-v1/runtime-contract.json') || !m.files.some(f => f.path.startsWith('node_modules/.prisma/')) || !m.files.some(f => f.path.startsWith('src/'))) fail('ARTIFACT_INCOMPLETE');
  for (const overlay of m.overlay_dispositions) if (!['RETAIN', 'RETIRE', 'MIGRATE'].includes(String(overlay.disposition)) || !overlay.authority_ref || !overlay.consumer_evidence_digest || (overlay.disposition === 'RETAIN' && (!git.safeParse(overlay.source_commit).success || !sha.safeParse(overlay.build_receipt_digest).success))) fail('OVERLAY_PROVENANCE');
  if (m.private_config.filter(b => b.purpose === 'service-env').length !== 1) fail('PRIVATE_ENV_BINDING');
  return m;
}
const planSchema = z.object({ schema_version: z.literal(1), parent_digest: sha, load_operation_id: uuid, old_identity: record, artifact_digest: sha, source_commit: git, source_tree: git, authority_pins: record, generated_identity: record, env_custody_digest: sha, original_lane_ref: nonempty, service_descriptor: record, read_set: z.array(nonempty), registry_delta: z.array(record), phase_a_operation_id: uuid, phase_a_plan_digest: sha, phase_a_receipt_digest: sha, reader_disposition_digest: sha, build_receipt_digest: sha, conformance_digest: sha, window_plan_digest: sha, deadline: stamp, plan_digest: sha }).strict();
export type Plan = z.infer<typeof planSchema>;
export function validatePlan(value: unknown): Plan { const p = planSchema.parse(value); const { plan_digest, ...rest } = p; if (digest(rest) !== plan_digest || Date.parse(p.deadline) <= Date.now()) fail('PLAN_DIGEST_OR_EXPIRY'); return p; }
function readCanonical(p: string): unknown { const s = fs.lstatSync(p); if (!s.isFile() || s.nlink !== 1 || s.uid !== 0 || s.gid !== 0 || (s.mode & 0o777) !== 0o600 || s.size > 16 * 1024 * 1024) fail('CUSTODY_RECORD'); const raw = fs.readFileSync(p, 'utf8'); const v = JSON.parse(raw); if (canonical(v) !== raw) fail('CUSTODY_ENCODING'); return v; }
function exclusiveRecord(dir: string, basename: string, value: unknown): void {
  secureAncestors(dir, 0o700); const fd = fs.openSync(path.join(dir, basename), fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeFileSync(fd, canonical(value)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const parent = fs.openSync(dir, fs.constants.O_RDONLY); try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
}
const deltaSchema = z.object({ path: nonempty, before: z.unknown(), after: z.unknown(), authority_id: z.enum(['AUTH_SERVICE_AGENT_CORE_MCP_CONVERSATION_AUDIENCE_CCR_V1', 'AUTH_SERVICE_MCP_CONVERSATION_PILOT_SUPPLY_V2']) }).strict();
export function compareRegistry(old: unknown, candidate: unknown, deltas: unknown[]): Record<string, unknown>[] {
  const expected = structuredClone(old) as Record<string, unknown>; const changes: Record<string, unknown>[] = [];
  for (const value of deltas) {
    const d = deltaSchema.parse(value); const segments = d.path.split('/').slice(1); if (!d.path.startsWith('/') || segments.some(s => ['__proto__', 'constructor', 'prototype'].includes(s))) fail('REGISTRY_DELTA_PATH');
    const metadataPaths = ['/contractVersion', '/reviewedSourceGitCommit', '/sourceBundleDigest', '/manifest/contract_version', '/manifest/audience_registry_version', '/manifest/lifecycle/contract_bundle_freeze/reviewed_source_git_commit', '/audienceRegistry/registry_version'];
    const oldRegistry = (old as { audienceRegistry?: { audiences?: Record<string, unknown>[] } }).audienceRegistry?.audiences;
    const targetIndex = oldRegistry?.findIndex(e => e.audience_id === 'agent-core-mcp-conversation-v1');
    const targetField = segments.length === 4 && segments[0] === 'audienceRegistry' && segments[1] === 'audiences' && targetIndex !== undefined && targetIndex >= 0 && segments[2] === String(targetIndex) && ['accepted_principal_types', 'notes'].includes(segments[3]);
    if (!metadataPaths.includes(d.path) && !targetField) fail('REGISTRY_AUTHORITY_SCOPE');
    if (targetField && segments[3] === 'accepted_principal_types' && (!same(d.before, ['agent']) || !same(d.after, ['service']))) fail('MCP_PROFILE_DELTA');
    let cursor: any = expected; for (const segment of segments.slice(0, -1)) { if (!cursor || !Object.hasOwn(cursor, segment)) fail('REGISTRY_DELTA_MISSING'); cursor = cursor[segment]; }
    const key = segments.at(-1)!; if (!cursor || !Object.hasOwn(cursor, key) || !same(cursor[key], d.before)) fail('REGISTRY_DELTA_PREIMAGE');
    cursor[key] = d.after; changes.push(d);
  }
  if (!same(expected, candidate)) fail('UNAUTHORIZED_REGISTRY_DRIFT'); return changes;
}
const audienceFields = ['audience_id', 'resource_service', 'scope_namespace', 'accepted_principal_types', 'registered_scopes', 'human_access_enabled', 'machine_access_enabled', 'delegated_access_enabled', 'status', 'freeze_ready'] as const;
const project = (v: Record<string, unknown>) => Object.fromEntries(audienceFields.map(k => [k, v[k]]));
export async function readAlignment(databaseUrl: string, payload: Record<string, unknown>, readSet: string[], auditId: string, expectedAudit: Record<string, unknown>) {
  const registry = (payload.audienceRegistry as { audiences: Record<string, unknown>[] }).audiences;
  if (!Array.isArray(registry) || !same(registry.map(v => v.audience_id).sort(), readSet) || new Set(readSet).size !== readSet.length) fail('DB_READ_SET');
  uuid.parse(auditId);
  const { PrismaClient, Prisma } = await import('@prisma/client');
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } }, log: [] });
  try {
    return await db.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
      const snapshot = await tx.$queryRaw<{ identity: string }[]>`SELECT txid_current_snapshot()::text AS identity`;
      const rows = await tx.$queryRaw<Record<string, unknown>[]>(Prisma.sql`SELECT audience_id, resource_service, scope_namespace, accepted_principal_types, registered_scopes, human_access_enabled, machine_access_enabled, delegated_access_enabled, status::text, freeze_ready, version, created_at, updated_at FROM auth_audiences WHERE audience_id IN (${Prisma.join(readSet)}) ORDER BY audience_id`);
      if (rows.length !== readSet.length) fail('DB_MISSING_OR_DUPLICATE');
      for (const row of rows) {
        const entry = registry.find(v => v.audience_id === row.audience_id); if (!entry || !same(project(entry), project(row))) fail('DB_REGISTRY_MISMATCH');
        if (row.audience_id === 'agent-core-mcp-conversation-v1' && row.version !== 2) fail('MCP_VERSION');
        for (const k of ['created_at', 'updated_at']) { if (!(row[k] instanceof Date)) fail('DB_TIMESTAMP'); row[k] = (row[k] as Date).toISOString(); }
      }
      const audits = await tx.$queryRaw<Record<string, unknown>[]>`SELECT id::text, event_type, result, request_correlation_id, details, timestamp FROM auth_security_audits WHERE id = ${auditId}::uuid`;
      if (audits.length !== 1) fail('MIGRATION_AUDIT_MISSING'); const audit = audits[0]; audit.timestamp = (audit.timestamp as Date).toISOString();
      if (!same(audit, expectedAudit)) fail('MIGRATION_AUDIT_MISMATCH');
      return { db_projection: rows, db_snapshot_identity: snapshot[0].identity, migration_audit_projection: audit };
    }, { timeout: 5000 });
  } finally { await db.$disconnect(); }
}
function osStart(pid: number): string { return execFileSync('/bin/ps', ['-p', String(pid), '-o', 'lstart='], { encoding: 'utf8' }).trim() || fail('PROCESS_GONE'); }
function generation(pid: number, uid: number, gid: number): z.infer<typeof generationSchema> { return { pid, uid, gid, start_nonce: randomBytes(32).toString('base64url'), start_time: osStart(pid), executable_digest: bytesDigest(fs.readFileSync(process.execPath)) }; }
function assertChild(m: Message, expected: Message, type: MessageType, mayHaveExited = false) {
  if (m.type !== type || !same(m.process_generation, expected.process_generation) || ['parent_digest', 'child_digest', 'operation_id', 'attempt_id', 'challenge_nonce'].some(k => m[k as keyof Message] !== expected[k as keyof Message])) fail('PROCESS_CHANNEL_BINDING');
  if (!mayHaveExited && m.process_generation.pid !== process.pid && osStart(m.process_generation.pid) !== m.process_generation.start_time) fail('PROCESS_GENERATION_CHANGED');
}
function moduleUrls(root: string) { return { env_module_url: pathToFileURL(path.join(root, 'dist/src/config/env.js')).href, contract_module_url: pathToFileURL(path.join(root, 'dist/src/lib/oauth/v1/contract.js')).href, server_module_url: pathToFileURL(path.join(root, 'dist/src/server.js')).href }; }
function checkModuleUrl(url: string, expected: string) { const u = new URL(url); if (u.search || u.hash || u.href !== expected || pathToFileURL(fs.realpathSync(fileURLToPath(u))).href !== expected) fail('MODULE_ALIAS'); }
export async function servingRole() {
  if (process.getuid?.() === 0 || process.getgroups?.().some(g => g !== process.getgid?.())) fail('SERVE_PRIVILEGE');
  const socket = new Socket({ fd: 3, readable: true, writable: true });
  const channel = new PrivateChannel(socket, () => process.exit(71));
  const challenge = await channel.receive(Date.now() + 5000); if (challenge.type !== 'LOAD_CHALLENGE') fail('LOAD_SEQUENCE');
  const p = payloadSchemas.LOAD_CHALLENGE.parse(challenge.payload);
  if (challenge.process_generation.pid !== process.pid || challenge.process_generation.uid !== process.getuid?.() || challenge.process_generation.gid !== process.getgid?.() || challenge.process_generation.start_time !== osStart(process.pid) || challenge.process_generation.executable_digest !== bytesDigest(fs.readFileSync(process.execPath))) fail('SELF_GENERATION');
  if (process.cwd() !== p.cwd || Date.now() >= Date.parse(p.deadline)) fail('LOAD_CWD_OR_EXPIRY');
  for (const key of ['NODE_OPTIONS', 'NODE_PATH', 'LD_PRELOAD', 'DYLD_INSERT_LIBRARIES', 'DYLD_LIBRARY_PATH', 'DOTENV_CONFIG_PATH']) if (process.env[key]) fail('ENV_INJECTION');
  if (fs.readdirSync(p.cwd).some(n => /^\.env(?:\.|$)/.test(n))) fail('ARTIFACT_DOTENV');
  const urls = moduleUrls(p.cwd); for (const k of Object.keys(urls) as (keyof typeof urls)[]) checkModuleUrl(p[k], urls[k]);
  const modulePins = Object.values(urls).map(u => bytesDigest(fs.readFileSync(fileURLToPath(u))));
  const initialEnv = digest(Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined)));
  const { env } = await import(urls.env_module_url); if (env.AUTH_CONTRACT_MODE !== 'v1') fail('SERVING_MODE');
  const keyIdentity = () => { if (!env.JWT_PRIVATE_KEY_FILE || env.JWT_PRIVATE_KEY) return null; fs.accessSync(env.JWT_PRIVATE_KEY_FILE, fs.constants.R_OK); const s = fs.lstatSync(env.JWT_PRIVATE_KEY_FILE); if (!s.isFile() || s.nlink !== 1 || fs.realpathSync(env.JWT_PRIVATE_KEY_FILE) !== env.JWT_PRIVATE_KEY_FILE) fail('PRIVATE_KEY_CHANGED'); return {dev:s.dev,ino:s.ino,uid:s.uid,gid:s.gid,mode:s.mode}; };
  const keyPin = keyIdentity();
  const contract = await import(urls.contract_module_url); const identity = contract.initializeAuthContract('v1'); const cached = contract.getV1RuntimeSnapshot(); const cachedDigest = digest(cached);
  const loaded: Message = { ...challenge, type: 'LOADED', sent_at: new Date().toISOString(), payload: { release_plan_digest: p.release_plan_digest, artifact_digest: p.artifact_digest, mode: 'v1', cwd: p.cwd, env_custody_digest: p.env_custody_digest, ...urls, contract_identity: identity, runtime_payload: cached, no_listen_yet: true } };
  channel.send(loaded);
  const resume = await channel.receive(Date.parse(p.deadline)); assertChild(resume, challenge, 'RESUME'); const r = payloadSchemas.RESUME.parse(resume.payload);
  if (r.loaded_digest !== digest(loaded) || r.release_plan_digest !== p.release_plan_digest || r.contract_module_url !== urls.contract_module_url || r.server_module_url !== urls.server_module_url || r.runtime_digest !== identity.runtimeDigest || Date.now() >= Date.parse(r.expires_at) || Date.parse(r.expires_at) - Date.parse(r.issued_at) > 5000 || Date.parse(r.issued_at) > Date.now() || Date.parse(r.expires_at) > Date.parse(p.deadline)) fail('RESUME_BINDING_OR_EXPIRY');
  if (contract.getV1RuntimeSnapshot() !== cached || digest(cached) !== cachedDigest || env.AUTH_CONTRACT_MODE !== 'v1' || process.cwd() !== p.cwd || initialEnv !== digest(Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined)))) fail('SERVING_STATE_CHANGED');
  for (const k of Object.keys(urls) as (keyof typeof urls)[]) checkModuleUrl(p[k], urls[k]);
  if (!same(keyPin, keyIdentity())) fail('PRIVATE_KEY_CHANGED');
  if (!same(modulePins, Object.values(urls).map(u => bytesDigest(fs.readFileSync(fileURLToPath(u)))))) fail('MODULE_BYTES_CHANGED');
  // The fixed server's static imports resolve to these exact URLs in this process.
  await import(urls.server_module_url);
  // Any subsequent frame, including a repeated RESUME, is fatal; EOF remains fatal.
  channel.rejectFurtherMessages();
}
const verifyInputSchema = z.object({ registry_delta: z.array(record), audit_id: uuid, audit_projection: record }).strict();
export async function verifierRole(raw: string) {
  if (process.getuid?.() === 0 || process.getgroups?.().some(g => g !== process.getgid?.())) fail('VERIFY_PRIVILEGE');
  const inputs = verifyInputSchema.parse(JSON.parse(raw)); if (canonical(inputs) !== raw) fail('VERIFY_INPUT_ENCODING');
  let resultSent = false;
  const channel = new PrivateChannel(new Socket({ fd: 3, readable: true, writable: true }), () => { if (!resultSent) process.exit(74); });
  const challenge = await channel.receive(Date.now() + 5000); if (challenge.type !== 'VERIFY_CHALLENGE' || challenge.process_generation.pid !== process.pid || challenge.process_generation.uid !== process.getuid?.() || challenge.process_generation.gid !== process.getgid?.() || challenge.process_generation.start_time !== osStart(process.pid)) fail('VERIFY_SEQUENCE');
  const p = payloadSchemas.VERIFY_CHALLENGE.parse(challenge.payload); if (Date.parse(p.deadline) <= Date.now()) fail('VERIFY_EXPIRED');
  const registry_diff = compareRegistry(p.old_loaded_projection, p.candidate_loaded_projection, inputs.registry_delta);
  if (!process.env.DATABASE_URL) fail('DB_CONFIG_MISSING');
  const alignment = await readAlignment(process.env.DATABASE_URL!, p.candidate_loaded_projection, p.read_set, inputs.audit_id, inputs.audit_projection);
  channel.send({ ...challenge, type: 'ALIGNED', sent_at: new Date().toISOString(), payload: { release_plan_digest: p.release_plan_digest, loaded_digest: p.loaded_digest, registry_diff, ...alignment, phase_a_receipt_digest: p.phase_a_receipt_digest, window_digest: p.window_digest, observed_at: new Date().toISOString(), result: 'ALIGNED' } });
  // Flush the single result then exit; there is no product listener or retry.
  resultSent = true;
  await new Promise<void>(resolve => channel.socket.end(resolve));
}
const outerSchema = z.object({ pid: integer.positive(), start_time: nonempty, start_nonce: nonce, actor_ref: nonempty }).strict();
const windowSchema = z.object({ window_id: uuid, operation_id: uuid, parent_digest: sha, actor: outerSchema, began_at: stamp, observed_at: stamp, excluded_writers: z.array(nonempty).min(1), no_listener: z.literal(true), drained: z.literal(true), old_processes_exited: z.literal(true), window_plan_digest: sha }).strict();
const windowEndSchema = z.object({ schema_version: z.literal(1), window_id: uuid, operation_id: uuid, parent_digest: sha, phase_b: z.union([z.object({ state: z.literal('not_started') }).strict(), z.object({ state: z.literal('terminal'), operation_id: uuid, terminal_receipt_digest: sha }).strict()]), ended_at: stamp, result: z.enum(['completed', 'stopped']), actor_ref: nonempty, holder_start_nonce: nonce }).strict();
export function readWindowEnd(fd: number, expected: z.infer<typeof windowSchema>): { state: 'pending' } | { state: 'sealed'; digest: string } {
  const s = fs.fstatSync(fd); if (!s.isFile() || s.nlink !== 1 || s.uid !== 0 || s.gid !== 0 || (s.mode & 0o777) !== 0o600 || s.size > LIMIT) fail('WINDOW_END_INODE');
  if (!s.size) return { state: 'pending' }; const bytes = Buffer.alloc(s.size); fs.readSync(fd, bytes, 0, bytes.length, 0);
  let value: unknown; try { value = JSON.parse(bytes.toString('utf8')); } catch { return { state: 'pending' }; }
  if (canonical(value) !== bytes.toString('utf8')) return { state: 'pending' };
  const parsed = windowEndSchema.safeParse(value); if (!parsed.success) return { state: 'pending' }; const end = parsed.data;
  if (end.window_id !== expected.window_id || end.operation_id !== expected.operation_id || end.parent_digest !== expected.parent_digest || end.actor_ref !== expected.actor.actor_ref || end.holder_start_nonce !== expected.actor.start_nonce || Date.parse(end.ended_at) > Date.now() || Date.parse(end.ended_at) < Date.parse(expected.began_at) || (end.result === 'completed' && end.phase_b.state !== 'terminal')) fail('WINDOW_END_BINDING');
  return { state: 'sealed', digest: digest(end) };
}
function assertOuter(window: z.infer<typeof windowSchema>) { if (osStart(window.actor.pid) !== window.actor.start_time) fail('OUTER_ACTOR_LOST'); }
function noListener(pid: number): void {
  try { const result = execFileSync('/usr/sbin/lsof', ['-nP', '-a', '-p', String(pid), '-iTCP', '-sTCP:LISTEN', '-Fn'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); if (result.trim()) fail('PREMATURE_LISTENER'); }
  catch (error) { const e = error as { status?: number; stdout?: Buffer; stderr?: Buffer }; if (e.status !== 1 || e.stdout?.length || e.stderr?.length) throw error; }
}
function privateEnvironment(m: Manifest, directory: string): NodeJS.ProcessEnv {
  const binding = m.private_config.find(b => b.purpose === 'service-env')!;
  if (binding.custody_ref !== 'preimage/service.env' || binding.mode !== 0o600 || binding.uid !== 0 || binding.gid !== 0) fail('PRIVATE_ENV_CUSTODY');
  const p = path.join(directory, binding.custody_ref); secureAncestors(p, 0o600);
  const fd = fs.openSync(p, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW); let text: string;
  try { const s = fs.fstatSync(fd); if (!s.isFile() || s.nlink !== 1 || ['dev', 'ino', 'uid', 'gid'].some(k => s[k as 'uid'] !== binding[k as 'uid'])) fail('PRIVATE_ENV_IDENTITY'); text = fs.readFileSync(fd, 'utf8'); } finally { fs.closeSync(fd); }
  const parsed = dotenv.parse(text!);
  for (const key of Object.keys(parsed)) if (/^(NODE_OPTIONS|NODE_PATH|DYLD_.*|LD_.*|DOTENV_CONFIG_.*)$/.test(key)) fail('PRIVATE_ENV_INJECTION');
  if (parsed.AUTH_CONTRACT_MODE !== 'v1' || (!isolatedBoundary ? parsed.PORT !== '4001' : !(Number(parsed.PORT) >= 20000 && Number(parsed.PORT) <= 65535)) || parsed.AUTH_HTTP_BIND_HOST !== '127.0.0.1') fail('PRIVATE_ENV_SERVICE_MODE');
  if (parsed.JWT_PRIVATE_KEY_FILE && !parsed.JWT_PRIVATE_KEY && !m.private_config.some(b => b.purpose === 'private-key' && b.custody_ref === parsed.JWT_PRIVATE_KEY_FILE)) fail('PRIVATE_KEY_UNBOUND');
  for (const b of m.private_config.filter(b => b.purpose === 'private-key')) {
    if (!path.isAbsolute(b.custody_ref)) fail('PRIVATE_KEY_PATH'); const s = fs.lstatSync(b.custody_ref); if (!s.isFile() || s.nlink !== 1 || fs.realpathSync(b.custody_ref) !== b.custody_ref || ['dev', 'ino', 'uid', 'gid'].some(k => s[k as 'uid'] !== b[k as 'uid']) || (s.mode & 0o777) !== b.mode) fail('PRIVATE_KEY_IDENTITY');
  }
  return { ...parsed, PATH: '/usr/bin:/bin', NODE_ENV: 'production' };
}
const descriptorSchema = z.object({ label: z.literal('com.auth-service'), uid: integer.positive(), gid: integer.positive(), username: z.literal('authsvc'), groupname: z.literal('authsvc'), KeepAlive: z.literal(false), RunAtLoad: z.literal(false), node_digest: sha }).strict();
export async function supervise(delegationId: string, operationId: string) { return superviseAttempt(delegationId, operationId); }

type FixtureAuthority = { root: string; artifactRoot: string; custody: Pick<import('./supply-mcp-conversation-pilot-v1.js').PilotCustody, 'parent' | 'parentDigest' | 'producerDigest' | 'readChild'>; window: {windowId: string; holderProcesses: Array<{pid:number;start_time:string}>; assertHeld(): void} };
/** Import-only disposable adapter. Never reachable by role argv or environment.
 * It substitutes native origin/artifact packaging only, not process/FD/DB/drop. */
export async function runIsolatedSupervisorFixture(delegationId: string, operationId: string, fixture: FixtureAuthority) {
  if (isolatedBoundary || process.getuid?.() !== 0 || !/^\/private\/tmp\/mcr-conformance-[A-Za-z0-9]+$/.test(fixture.root) || fs.realpathSync(fixture.root) !== fixture.root || fs.lstatSync(fixture.root).uid !== 0 || !fixture.artifactRoot.startsWith(fixture.root + '/') || fs.realpathSync(fixture.artifactRoot) !== fixture.artifactRoot) fail('ISOLATED_FIXTURE_BOUNDARY');
  const claimed = await fixture.custody.readChild('candidate-load');
  if (!claimed.operationDirectory.startsWith(fixture.root + '/') || claimed.child.environment !== 'production' || fixture.custody.parent.delegation_id !== delegationId) fail('ISOLATED_FIXTURE_CUSTODY');
  isolatedBoundary = fixture.root;
  return superviseAttempt(delegationId, operationId, fixture);
}
async function superviseAttempt(delegationId: string, operationId: string, fixture?: FixtureAuthority) {
  uuid.parse(delegationId); uuid.parse(operationId);
  if (process.getuid?.() !== 0 || process.getgid?.() !== 0) fail('SUPERVISOR_PRIVILEGE');
  // Origin validation is Supply's actual receiver/custody chain, not a JSON boolean.
  const supply = await import('./supply-mcp-conversation-pilot-v1.js');
  const custody = fixture?.custody ?? await supply.openPilotCustody(delegationId);
  const claimed = fixture ? await custody.readChild('candidate-load') : await supply.verifyPilotAdmission(custody as import('./supply-mcp-conversation-pilot-v1.js').PilotCustody, 'candidate-load');
  const plan = validatePlan(claimed.plan);
  if (claimed.child.operation_id !== operationId || plan.load_operation_id !== operationId || plan.parent_digest !== custody.parentDigest || claimed.child.plan_digest !== plan.plan_digest || claimed.child.source_commit !== plan.source_commit || claimed.child.artifact_digest !== plan.artifact_digest) fail('LOAD_CHILD_BINDING');
  const directory = claimed.operationDirectory; secureAncestors(directory, 0o700);
  const admission = fixture?.window ?? await supply.verifyPilotWindow(custody as import('./supply-mcp-conversation-pilot-v1.js').PilotCustody);
  let serve: ChildProcess | undefined, verify: ChildProcess | undefined; let sent = false; let dropped = false; let journal = -1, windowFd = -1; let sequence = 0;
  const supervisorGeneration = generation(process.pid, process.getuid!(), process.getgid!());
  const append = (stage: string, evidence: Record<string, unknown>) => { if (journal < 0) fail('JOURNAL_CLOSED'); fs.writeSync(journal, canonical({ schema_version: 1, sequence: ++sequence, operation_id: operationId, parent_digest: custody.parentDigest, child_digest: claimed.childDigest, supervisor_generation: supervisorGeneration, stage, observed_at: new Date().toISOString(), evidence }) + '\n'); fs.fsyncSync(journal); };
  try {
    const manifest = manifestSchema.parse(readCanonical(path.join(directory, 'artifact-manifest.json')));
    const root = fixture?.artifactRoot ?? `/Library/Application Support/auth-service/mcp-pilot-v2/releases/${plan.artifact_digest}`;
    if (!fixture) validateArtifact(root, manifest);
    if (manifest.artifact_digest !== plan.artifact_digest || manifest.source_commit !== plan.source_commit || manifest.source_tree !== plan.source_tree || !same(manifest.authority_pins, plan.authority_pins) || !same(manifest.generated_identity, plan.generated_identity) || digest(manifest.private_config) !== plan.env_custody_digest || process.cwd() !== root || (!fixture && fs.realpathSync(process.execPath) !== path.join(root, manifest.entrypoints.node))) fail('INSTALLED_BINDING');
    if (!fixture) {
      const preimage = readCanonical(path.join(directory, 'installed-preimage.json')) as Record<string, unknown>;
      if (!sha.safeParse(plan.old_identity.preimage_manifest_digest).success || digest(preimage) !== plan.old_identity.preimage_manifest_digest || !Array.isArray(preimage.overlays)) fail('INSTALLED_PREIMAGE_UNPROVEN');
      const oldNames = (preimage.overlays as Record<string, unknown>[]).map(o => nonempty.parse(o.path)).sort();
      const dispositions = manifest.overlay_dispositions.map(o => nonempty.parse(o.path)).sort();
      if (new Set(oldNames).size !== oldNames.length || !same(oldNames, dispositions)) fail('OVERLAY_OMISSION');
    }
    const descriptor = descriptorSchema.parse(plan.service_descriptor);
    if (descriptor.node_digest !== bytesDigest(fs.readFileSync(process.execPath))) fail('NODE_IDENTITY');
    const stop = windowSchema.parse(readCanonical(path.join(directory, 'stop.json')));
    if (stop.operation_id !== operationId || stop.parent_digest !== custody.parentDigest || stop.window_id !== admission.windowId || stop.window_plan_digest !== plan.window_plan_digest || stop.actor.actor_ref !== plan.original_lane_ref || Date.now() - Date.parse(stop.observed_at) > 5000) fail('STOP_WINDOW_STALE'); assertOuter(stop);
    const phaseA = readCanonical(path.join(directory, 'phase-a.json')) as Record<string, unknown>;
    if (digest(phaseA) !== plan.phase_a_receipt_digest || phaseA.operation_id !== plan.phase_a_operation_id || phaseA.plan_digest !== plan.phase_a_plan_digest) fail('PHASE_A_LINK');
    const verificationInputs = verifyInputSchema.parse({ registry_delta: plan.registry_delta, audit_id: phaseA.audit_id, audit_projection: phaseA.audit_projection });
    const old = plan.old_identity;
    if (!old.runtime_payload || typeof old.runtime_payload_json !== 'string' || old.runtime_digest !== bytesDigest(old.runtime_payload_json) || !same(JSON.parse(old.runtime_payload_json), old.runtime_payload) || !old.process_generation || !old.listener_observation || !old.handler_provenance) fail('OLD_LOADED_PROVENANCE');
    const env = privateEnvironment(manifest, directory);
    journal = fs.openSync(path.join(directory, 'journal.jsonl'), fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_NOFOLLOW | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
    const journalStat = fs.fstatSync(journal); if (journalStat.size !== 0) fail('SUPERVISOR_ALREADY_CLAIMED'); if (journalStat.uid !== 0 || journalStat.gid !== 0 || journalStat.nlink !== 1 || (journalStat.mode & 0o777) !== 0o600) fail('JOURNAL_IDENTITY');
    windowFd = fs.openSync(path.join(directory, 'window-end.json'), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    if (fs.fstatSync(windowFd).size !== 0 || readWindowEnd(windowFd, stop).state !== 'pending') fail('WINDOW_END_REPLAY');
    const journalParent = fs.openSync(directory, fs.constants.O_RDONLY); try { fs.fsyncSync(journalParent); } finally { fs.closeSync(journalParent); }
    append('SUPERVISOR_CLAIMED', { producer_digest: custody.producerDigest, plan_digest: plan.plan_digest, window_id: admission.windowId });
    const deadline = Math.min(Date.parse(plan.deadline), Date.parse(claimed.child.expires_at), Date.parse(custody.parent.expires_at));
    if (deadline <= Date.now()) fail('LOAD_EXPIRED');
    const script = path.join(root, manifest.entrypoints.wrapper);
    const launch = (role: 'serve' | 'verify', args: string[] = []) => spawn(process.execPath, [script, role, ...args], { cwd: root, env, uid: descriptor.uid, gid: descriptor.gid, stdio: ['ignore', 'inherit', 'inherit', 'pipe'] });
    serve = launch('serve'); if (!serve.pid) fail('SERVE_SPAWN');
    const serving = serve;
    let serveExited = false; serving.once('exit', () => { serveExited = true; });
    const servingChannel = new PrivateChannel(serving.stdio[3] as Socket, () => { if (!serveExited) serving.kill('SIGKILL'); });
    const challenge: Message = { schema_version: 1, type: 'LOAD_CHALLENGE', parent_digest: custody.parentDigest, child_digest: claimed.childDigest, operation_id: operationId, attempt_id: operationId, process_generation: generation(serving.pid!, descriptor.uid, descriptor.gid), challenge_nonce: randomBytes(32).toString('base64url'), sent_at: new Date().toISOString(), payload: { release_plan_digest: plan.plan_digest, artifact_digest: plan.artifact_digest, expected_mode: 'v1', cwd: root, env_custody_digest: plan.env_custody_digest, ...moduleUrls(root), deadline: new Date(deadline).toISOString() } };
    servingChannel.send(challenge); const loaded = await servingChannel.receive(deadline); assertChild(loaded, challenge, 'LOADED');
    const lp = payloadSchemas.LOADED.parse(loaded.payload); noListener(serving.pid!);
    if (lp.release_plan_digest !== plan.plan_digest || lp.artifact_digest !== plan.artifact_digest || lp.cwd !== root || lp.env_custody_digest !== plan.env_custody_digest || !same(lp.contract_identity, manifest.generated_identity)) fail('LOADED_IDENTITY');
    exclusiveRecord(directory, 'loaded.json', loaded);
    verify = launch('verify', [canonical(verificationInputs)]); if (!verify.pid) fail('VERIFY_SPAWN');
    const verifying = verify; let verifierExited = false;
    const verifierExit = new Promise<number | null>(resolve => verifying.once('exit', code => { verifierExited = true; resolve(code); }));
    const verifierChannel = new PrivateChannel(verifying.stdio[3] as Socket, () => { /* EOF after the one ALIGNED is expected; exit code is independently checked. */ });
    const verifyChallenge: Message = { ...challenge, type: 'VERIFY_CHALLENGE', process_generation: generation(verifying.pid!, descriptor.uid, descriptor.gid), challenge_nonce: randomBytes(32).toString('base64url'), sent_at: new Date().toISOString(), payload: { release_plan_digest: plan.plan_digest, loaded_digest: digest(loaded), old_loaded_projection: old.runtime_payload, candidate_loaded_projection: lp.runtime_payload, read_set: plan.read_set, phase_a_receipt_digest: plan.phase_a_receipt_digest, window_digest: digest(stop), deadline: new Date(deadline).toISOString() } };
    verifierChannel.send(verifyChallenge); const aligned = await verifierChannel.receive(deadline); assertChild(aligned, verifyChallenge, 'ALIGNED', true);
    if (await Promise.race([verifierExit, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('VERIFIER_EXIT_TIMEOUT')), 1000))]) !== 0 || !verifierExited) fail('VERIFIER_NOT_TERMINAL');
    const ap = payloadSchemas.ALIGNED.parse(aligned.payload);
    if (ap.release_plan_digest !== plan.plan_digest || ap.loaded_digest !== digest(loaded) || ap.window_digest !== digest(stop) || ap.phase_a_receipt_digest !== plan.phase_a_receipt_digest) fail('ALIGNMENT_BINDING');
    exclusiveRecord(directory, 'db-alignment.json', aligned);
    // Fresh actual projection, still under the same original admission/window.
    admission.assertHeld(); assertOuter(stop); noListener(serving.pid!);
    const fresh = await readAlignment(env.DATABASE_URL!, lp.runtime_payload, plan.read_set, verificationInputs.audit_id, verificationInputs.audit_projection);
    if (!same(fresh.db_projection, ap.db_projection) || !same(fresh.migration_audit_projection, ap.migration_audit_projection) || Date.now() - Date.parse(ap.observed_at) > 5000) fail('ALIGNMENT_STALE_OR_CHANGED');
    const issued = Date.now(), expires = Math.min(issued + 5000, deadline);
    const resume: Message = { ...challenge, type: 'RESUME', sent_at: new Date(issued).toISOString(), payload: { release_plan_digest: plan.plan_digest, loaded_digest: digest(loaded), alignment_digest: digest(aligned), window_digest: digest(stop), mode: 'v1', contract_module_url: lp.contract_module_url, server_module_url: lp.server_module_url, runtime_digest: lp.contract_identity.runtimeDigest, db_projection_digest: digest(ap.db_projection), phase_a_receipt_digest: plan.phase_a_receipt_digest, resume_nonce: randomBytes(32).toString('base64url'), issued_at: new Date(issued).toISOString(), expires_at: new Date(expires).toISOString() } };
    exclusiveRecord(directory, 'resume-claim.json', { producer_digest: custody.producerDigest, resume });
    append('RESUME_CLAIMED', { loaded_digest: digest(loaded), alignment_digest: digest(aligned), process_generation: challenge.process_generation });
    admission.assertHeld(); // Original outer actor retains both existing locks across Phase B.
    irreversibleDrop(descriptor.uid, descriptor.gid); dropped = true;
    if (Date.now() >= expires || serveExited) fail('DROP_DEADLINE_OR_CHILD_EXIT'); assertOuter(stop);
    append('PRIVILEGE_DROPPED', { uid: process.getuid!(), gid: process.getgid!(), groups: process.getgroups!() });
    sent = true; servingChannel.send(resume); append('RESUME_SENT', { resume_digest: digest(resume), process_generation: challenge.process_generation });
    let handedOff = false, outerLost = false;
    const monitor = setInterval(() => { try {
      if (!handedOff) { const end = readWindowEnd(windowFd, stop); if (end.state === 'sealed') { handedOff = true; append('WINDOW_END_ACK', { window_end_digest: end.digest }); } else { assertOuter(stop); for (const holder of admission.holderProcesses) if (osStart(holder.pid) !== holder.start_time) fail('ORIGINAL_WINDOW_HOLDER_LOST'); } }
    } catch { outerLost = true; serving.kill('SIGKILL'); } }, 100);
    await new Promise<void>(resolve => { if (serveExited) resolve(); else serving.once('exit', () => resolve()); });
    append('CHILD_EXITED', { result: 'STOPPED_AFTER_CRASH', process_generation: challenge.process_generation });
    const terminalDeadline = Date.now() + 5000;
    while (!handedOff && !outerLost && Date.now() < terminalDeadline) await new Promise(resolve => setTimeout(resolve, 50));
    clearInterval(monitor);
  } catch {
    serve?.kill('SIGKILL'); verify?.kill('SIGKILL');
    if (journal >= 0) append('FAILURE', { result: sent ? 'RESUME_OUTCOME_UNKNOWN' : 'LOAD_REFUSED', privilege_dropped: dropped, resume_sent: sent });
    throw new Error(sent ? 'RESUME_OUTCOME_UNKNOWN' : 'LOAD_REFUSED');
  } finally { if (journal >= 0) fs.closeSync(journal); if (windowFd >= 0) fs.closeSync(windowFd); }
}
/** The original privileged outer actor calls this after independently observing
 * the journal. The dropped supervisor cannot create root-only terminal files. */
export async function sealServingObservation(delegationId: string, operationId: string) {
  if (process.getuid?.() !== 0) fail('OUTER_PRIVILEGE');
  const { openPilotCustody } = await import('./supply-mcp-conversation-pilot-v1.js');
  const custody = await openPilotCustody(delegationId), claimed = await custody.readChild('candidate-load');
  if (claimed.child.operation_id !== operationId) fail('OUTER_OPERATION');
  const dir = claimed.operationDirectory, plan = validatePlan(claimed.plan);
  secureAncestors(dir, 0o700);
  const window = windowSchema.parse(readCanonical(path.join(dir, 'stop.json')));
  if (window.actor.pid !== process.pid || osStart(process.pid) !== window.actor.start_time || window.actor.actor_ref !== custody.parent.executor_ref) fail('ORIGINAL_OUTER_ONLY');
  const loaded = parseMessage(readCanonical(path.join(dir, 'loaded.json'))), aligned = parseMessage(readCanonical(path.join(dir, 'db-alignment.json')));
  const claim = z.object({ producer_digest: sha, resume: messageSchema }).strict().parse(readCanonical(path.join(dir, 'resume-claim.json')));
  const resume = parseMessage(claim.resume);
  if (claim.producer_digest !== custody.producerDigest || resume.type !== 'RESUME' || loaded.type !== 'LOADED' || aligned.type !== 'ALIGNED' || resume.payload.loaded_digest !== digest(loaded) || resume.payload.alignment_digest !== digest(aligned)) fail('OUTER_STAGE_LINK');
  const journalPath = path.join(dir, 'journal.jsonl'), stat = fs.lstatSync(journalPath);
  if (!stat.isFile() || stat.nlink !== 1 || stat.uid !== 0 || stat.gid !== 0 || (stat.mode & 0o777) !== 0o600 || stat.size > 1048576) fail('OUTER_JOURNAL_IDENTITY');
  const raw = fs.readFileSync(journalPath, 'utf8'); if (!raw.endsWith('\n')) fail('OUTER_JOURNAL_PARTIAL');
  const lines = raw.trimEnd().split('\n').map((line, i) => {
    const v = JSON.parse(line); if (canonical(v) !== line || v.sequence !== i + 1 || v.operation_id !== operationId || v.parent_digest !== custody.parentDigest || v.child_digest !== claimed.childDigest) fail('OUTER_JOURNAL_SEQUENCE');
    generationSchema.parse(v.supervisor_generation); return v;
  });
  const sent = lines.find(v => v.stage === 'RESUME_SENT');
  if (!sent || lines.some(v => ['FAILURE', 'CHILD_EXITED'].includes(v.stage)) || sent.evidence.resume_digest !== digest(resume) || !lines.some(v => v.stage === 'PRIVILEGE_DROPPED')) fail('OUTER_RESUME_NOT_PROVEN');
  const sg = sent.supervisor_generation; if (osStart(sg.pid) !== sg.start_time || !lines.every(v => same(v.supervisor_generation, sg))) fail('OUTER_SUPERVISOR_CHANGED');
  const g = generationSchema.parse(loaded.process_generation); if (osStart(g.pid) !== g.start_time) fail('OUTER_SERVE_CHANGED');
  const descriptor = descriptorSchema.parse(plan.service_descriptor);
  const observedIds = execFileSync('/bin/ps', ['-p', String(g.pid), '-o', 'uid=', '-o', 'gid='], { encoding: 'utf8' }).trim().split(/\s+/).map(Number);
  if (!same(observedIds, [descriptor.uid, descriptor.gid])) fail('OUTER_SERVE_IDENTITY');
  const listener = execFileSync('/usr/sbin/lsof', ['-nP', '-a', '-p', String(g.pid), '-iTCP:4001', '-sTCP:LISTEN', '-Fn'], { encoding: 'utf8' });
  if (!listener.split('\n').includes('n127.0.0.1:4001')) fail('OUTER_LISTENER_BINDING');
  const response = await fetch('http://127.0.0.1:4001/api/health', { signal: AbortSignal.timeout(1000), redirect: 'error' });
  if (!response.ok) fail('OUTER_INTERFACE_FAILED');
  const health = await response.json();
  const identity = loaded.payload.contract_identity as Record<string, unknown>;
  if (health.ok !== true || health.service !== 'auth-service' || health.authContractMode !== 'v1' || health.authContractVersion !== identity.contractVersion || health.authContractDigest !== identity.runtimeDigest) fail('OUTER_INTERFACE_IDENTITY');
  const receipt = { schema_version: 1, operation_id: operationId, attempt_id: loaded.attempt_id, parent_digest: custody.parentDigest, child_digest: claimed.childDigest,
    source_commit: plan.source_commit, artifact_digest: plan.artifact_digest, process_generation: g, mode: 'v1',
    module_urls: { env: loaded.payload.env_module_url, contract: loaded.payload.contract_module_url, server: loaded.payload.server_module_url },
    runtime_identity: loaded.payload.contract_identity, loaded_digest: digest(loaded), alignment_digest: digest(aligned), phase_a_receipt_digest: plan.phase_a_receipt_digest,
    listener_observation: { pid: g.pid, address: '127.0.0.1', port: 4001, observed_at: new Date().toISOString() },
    interface_check_results: { health_status: response.status, health_projection_digest: digest(health) }, resumed_at: resume.sent_at, window_id: window.window_id, window_state: 'held_for_phase_b', result: 'SERVING_VERIFIED' };
  exclusiveRecord(dir, 'serving.json', receipt);
  await custody.appendStage('candidate-load', 'ALIGNED', digest(receipt));
  return receipt;
}
export async function sealFailureObservation(delegationId: string, operationId: string) {
  if (process.getuid?.() !== 0) fail('OUTER_PRIVILEGE');
  const { openPilotCustody } = await import('./supply-mcp-conversation-pilot-v1.js');
  const custody = await openPilotCustody(delegationId), claimed = await custody.readChild('candidate-load');
  if (claimed.child.operation_id !== operationId) fail('OUTER_OPERATION');
  const dir = claimed.operationDirectory; secureAncestors(dir, 0o700);
  const window = windowSchema.parse(readCanonical(path.join(dir, 'stop.json')));
  if (window.actor.pid !== process.pid || osStart(process.pid) !== window.actor.start_time || window.actor.actor_ref !== custody.parent.executor_ref) fail('ORIGINAL_OUTER_ONLY');
  let exitObserved = false, noListenerObserved = false;
  const loadedPath = path.join(dir, 'loaded.json');
  if (fs.existsSync(loadedPath)) {
    const loaded = parseMessage(readCanonical(loadedPath));
    try { exitObserved = osStart(loaded.process_generation.pid) !== loaded.process_generation.start_time; }
    catch { // A privileged positive process inventory distinguishes actual absence from a query failure.
      const pids = execFileSync('/bin/ps', ['-axo', 'pid='], { encoding: 'utf8' }).trim().split(/\s+/).map(Number);
      exitObserved = !pids.includes(loaded.process_generation.pid);
    }
    try { execFileSync('/usr/sbin/lsof', ['-nP', '-iTCP:4001', '-sTCP:LISTEN', '-Fn'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { const error = e as {status?: number; stdout?: Buffer; stderr?: Buffer}; noListenerObserved = error.status === 1 && !error.stdout?.length && !error.stderr?.length; }
  }
  const stopped = exitObserved && noListenerObserved;
  const receipt = { schema_version: 1, operation_id: operationId, parent_digest: custody.parentDigest, child_digest: claimed.childDigest,
    observed_at: new Date().toISOString(), result: stopped ? 'LOAD_FAILED_STOPPED' : 'RESUME_OUTCOME_UNKNOWN',
    process_exit_observed: exitObserved, no_listener_observed: noListenerObserved, window_id: window.window_id,
    performed_effects: { load_attempt: true, resume_claim_exists: fs.existsSync(path.join(dir, 'resume-claim.json')) },
    not_performed_effects: { retry: true, automatic_restore: true, database_mutation_by_release: true },
    phase_b_state: 'NOT_ESTABLISHED', fence: 'PRESERVED', window_state: 'HELD_PENDING_ORIGINAL_RECONCILIATION' };
  exclusiveRecord(dir, 'failure.json', receipt);
  await custody.appendStage('candidate-load', stopped ? 'STOPPED' : 'OUTCOME_UNKNOWN', digest(receipt));
  return receipt;
}
/** Open before launching supervise; only this original outer descriptor writes
 * the terminal handoff inode. The dropped supervisor retains a read-only FD. */
export async function openOuterWindowEnd(delegationId: string, operationId: string) {
  if (process.getuid?.() !== 0) fail('OUTER_PRIVILEGE');
  const supply = await import('./supply-mcp-conversation-pilot-v1.js');
  const custody = await supply.openPilotCustody(delegationId), child = await custody.readChild('candidate-load');
  if (child.child.operation_id !== operationId) fail('OUTER_OPERATION');
  const directory = child.operationDirectory; secureAncestors(directory, 0o700);
  const window = windowSchema.parse(readCanonical(path.join(directory, 'stop.json')));
  if (window.actor.pid !== process.pid || window.actor.start_time !== osStart(process.pid) || window.actor.actor_ref !== custody.parent.executor_ref) fail('ORIGINAL_OUTER_ONLY');
  const retained = await supply.verifyPilotWindow(custody); retained.assertHeld();
  if (retained.windowId !== window.window_id) fail('OUTER_WINDOW_ID');
  const fd = fs.openSync(path.join(directory, 'window-end.json'), fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR | fs.constants.O_NOFOLLOW, 0o600);
  fs.fsyncSync(fd); const parentFd = fs.openSync(directory, fs.constants.O_RDONLY); try { fs.fsyncSync(parentFd); } finally { fs.closeSync(parentFd); }
  const pinned = fs.fstatSync(fd); let consumed = false;
  return { async finish(result: 'completed' | 'stopped') {
    if (consumed) fail('WINDOW_END_ALREADY_CONSUMED'); retained.assertHeld(); assertOuter(window);
    let phaseB: {state: 'not_started'} | {state: 'terminal'; operation_id: string; terminal_receipt_digest: string};
    const claimPath = path.join(path.dirname(directory), 'claims', 'supply.json');
    let supplyClaimExists = true;
    try { fs.lstatSync(claimPath); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; supplyClaimExists = false; }
    if (!supplyClaimExists) phaseB = {state: 'not_started'};
    else {
      const terminal = await supply.readPilotTerminal(custody, 'supply');
      if (!['COMMITTED', 'EXACT_RERUN_NOOP', 'REFUSED', 'ROLLED_BACK'].includes(terminal.result)) fail('PHASE_B_NOT_TERMINAL');
      if (result === 'completed' && !['COMMITTED', 'EXACT_RERUN_NOOP'].includes(terminal.result)) fail('PHASE_B_NOT_SUCCESSFUL');
      phaseB = {state: 'terminal', operation_id: uuid.parse(terminal.operation_id), terminal_receipt_digest: digest(terminal)};
    }
    if (result === 'completed' && phaseB.state !== 'terminal') fail('PHASE_B_NOT_STARTED');
    if (result === 'stopped') {
      const loaded = parseMessage(readCanonical(path.join(directory, 'loaded.json')));
      const pids = execFileSync('/bin/ps', ['-axo', 'pid='], {encoding: 'utf8'}).trim().split(/\s+/).map(Number);
      if (pids.includes(loaded.process_generation.pid)) fail('WINDOW_STOP_EXIT_NOT_PROVEN');
      let provenNoListener = false;
      try { execFileSync('/usr/sbin/lsof', ['-nP', '-iTCP:4001', '-sTCP:LISTEN', '-Fn'], { stdio: ['ignore', 'pipe', 'pipe'] }); }
      catch (error) { const e = error as {status?: number; stdout?: Buffer; stderr?: Buffer}; provenNoListener = e.status === 1 && !e.stdout?.length && !e.stderr?.length; }
      if (!provenNoListener) fail('WINDOW_STOP_NOT_PROVEN');
    }
    const current = fs.fstatSync(fd); if (current.dev !== pinned.dev || current.ino !== pinned.ino || current.size !== 0) fail('WINDOW_END_INODE_CHANGED');
    const record = windowEndSchema.parse({schema_version: 1, window_id: window.window_id, operation_id: operationId, parent_digest: custody.parentDigest,
      phase_b: phaseB, ended_at: new Date().toISOString(), result, actor_ref: window.actor.actor_ref, holder_start_nonce: window.actor.start_nonce});
    consumed = true; const body = Buffer.from(canonical(record)); let at = 0;
    try { while (at < body.length) at += fs.writeSync(fd, body, at, body.length - at, at); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    const expectedDigest = digest(record), deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const journal = fs.readFileSync(path.join(directory, 'journal.jsonl'), 'utf8');
      const complete = journal.slice(0, journal.lastIndexOf('\n')).split('\n');
      for (let i = 0; i < complete.length; i++) {
        const row = JSON.parse(complete[i]); if (canonical(row) !== complete[i] || row.sequence !== i + 1 || row.operation_id !== operationId || row.parent_digest !== custody.parentDigest) fail('WINDOW_ACK_JOURNAL_INVALID');
        if (row.stage === 'WINDOW_END_ACK' && row.evidence.window_end_digest === expectedDigest) return record;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return fail('WINDOW_HANDOFF_UNKNOWN'); // The outer actor must keep exclusion; never auto-release.
  } };
}
async function main(args: string[]) {
  if (args[0] === 'supervise' && args.length === 3) return supervise(args[1], args[2]);
  if (args[0] === 'serve' && args.length === 1) return servingRole();
  if (args[0] === 'verify' && args.length === 2) return verifierRole(args[1]);
  fail('CLOSED_ROLE_ARGUMENTS');
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) void main(process.argv.slice(2)).catch(() => { process.stderr.write('AUTH_MCP_RELEASE_REFUSED\n'); process.exit(1); });
