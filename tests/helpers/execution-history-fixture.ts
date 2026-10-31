import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { hashClientSecret } from '../../src/lib/oauth/secret.js';
import { getV1AudienceDefinitions } from '../../src/lib/oauth/v1/contract.js';

export const AUDIENCE = 'execution-history';
export const READ = 'execution.history.read';
export const AUDIT = 'execution.history.audit';
export const PRINCIPAL = '94000000-0000-4000-8000-000000000001';
export const CLIENT = '94000000-0000-4000-8000-000000000002';
export const SECRET = 'synthetic-auth94-client-secret-never-log';
export const RAW = 'synthetic-auth94-raw-session-never-log';

// Persistence alone is replaced. Real provisioning, scope, issuer, signer,
// verifier and audit code execute. No Prisma connection or HTTP endpoint.
export function fixture() {
  const principal: any = { id: PRINCIPAL, principalType: 'agent', agentId: 'agt_auth94_fixture',
    externalRef: 'agentcore:v1:principal:agt_auth94_fixture', ownerUserId: null, status: 'active' };
  const state: any = { clients: [], grants: [], audits: [] };
  let failAudit = false;
  let failRead = false;
  let failCas = false;
  const key = (where: any) => where.machineClientId_audienceId ?? where;
  const findGrant = (where: any) => state.grants.find((g: any) => {
    const k = key(where);
    return g.machineClientId === k.machineClientId && g.audienceId === k.audienceId
      && (k.version === undefined || g.version === k.version)
      && (!k.scopes || JSON.stringify(g.scopes) === JSON.stringify(k.scopes.equals));
  });
  const store: any = {
    machinePrincipal: { findUnique: async () => principal },
    machineClient: {
      findUnique: async ({ where, include }: any) => {
        const c = state.clients.find((c: any) => where.id ? c.id === where.id
          : where.clientId ? c.clientId === where.clientId : c.externalRef === where.externalRef);
        if (!c) return null;
        return { ...c, principal, accessGrants: state.grants.filter((g: any) => g.machineClientId === c.id
          && (!include?.accessGrants?.where || g.audienceId === include.accessGrants.where.audienceId))
          .map((g: any) => ({ ...g, audience: storedAudience() })) };
      },
      create: async ({ data }: any) => {
        const c = { ...data, id: CLIENT, status: 'active', createdAt: new Date() };
        state.clients.push(c); return c;
      },
    },
    authAudience: { findUnique: async ({ where }: any) => where.audienceId === AUDIENCE ? storedAudience() : null },
    machineAccessGrant: {
      findUnique: async ({ where }: any) => { const row = findGrant(where); return row ? structuredClone(row) : null; },
      create: async ({ data }: any) => {
        if (failRead && data.scopes.includes(READ)) throw new Error('synthetic_read_store_failure');
        assert.equal(findGrant(data), undefined, 'composite PK');
        const row = { ...data, version: data.version ?? 1 }; state.grants.push(row); return row;
      },
      updateMany: async ({ where, data }: any) => {
        if (failCas) return { count: 0 };
        const row = findGrant(where); if (!row) return { count: 0 };
        row.scopes = [...data.scopes]; row.version = typeof data.version === 'number'
          ? data.version : row.version + data.version.increment;
        return { count: 1 };
      },
      deleteMany: async ({ where }: any) => {
        if (failCas) return { count: 0 };
        const row = findGrant(where); if (!row) return { count: 0 };
        state.grants.splice(state.grants.indexOf(row), 1); return { count: 1 };
      },
    },
    grantChangeAudit: {
      findMany: async ({ where }: any) => state.audits.filter((a: any) => a.migrationId === where.migrationId),
      create: async ({ data }: any) => {
        if (failAudit) throw new Error('synthetic_audit_store_failure');
        assert.match(data.sourceGitCommit, /^[0-9a-f]{40}$/);
        assert.ok(data.resultingGrantVersion >= 1);
        assert.ok(data.expectedGrantVersion === null || data.expectedGrantVersion >= 1);
        assert.equal(data.afterValue === Prisma.DbNull, data.changeType === 'revoke', 'SQL value-shape CHECK');
        assert.ok(!state.audits.some((a: any) => a.migrationId === data.migrationId
          && a.clientId === data.clientId && a.changeType === data.changeType), 'audit unique key');
        const row = { ...data, id: `synthetic-audit-${state.audits.length + 1}` };
        state.audits.push(row); return row;
      },
    },
    $executeRaw: async () => 1,
    $transaction: async (run: any, options: any) => {
      if (options) assert.equal(options.isolationLevel, 'Serializable');
      const saved = structuredClone(state);
      try { return await run(store); }
      catch (error) { Object.assign(state, saved); throw error; }
    },
  };
  function register() {
    state.clients.push({ id: CLIENT, clientId: 'mc_auth94_synthetic', machinePrincipalId: PRINCIPAL,
      externalRef: 'agentcore:v1:client:agt_auth94_fixture', secretHash: hashClientSecret(SECRET),
      status: 'active', createdAt: new Date() });
  }
  return { store, state, principal, register, failAudit: () => { failAudit = true; },
    failRead: () => { failRead = true; }, failCas: () => { failCas = true; } };
}

export function storedAudience() {
  const a = getV1AudienceDefinitions().find((a) => a.audienceId === AUDIENCE);
  assert.ok(a, 'accepted execution-history audience must be registered');
  return { ...a, registeredScopes: [...a.registeredScopes], acceptedPrincipalTypes: [...a.acceptedPrincipalTypes], version: 1 };
}

export function instruction(operation: 'provision' | 'revoke', expectedGrantVersion: number | null) {
  return { operation, clientId: 'mc_auth94_synthetic', expectedGrantVersion,
    migrationId: `execution-history-auth94-${crypto.randomUUID()}`,
    sourceGitCommit: '8fb8643519fa6f160bba79e78c5170a312018880', operatorId: 'synthetic-owner-operator',
    approvalRef: 'synthetic-owner-instruction:auth94' };
}

export const request = { clientId: 'mc_auth94_synthetic', clientSecret: SECRET, resource: AUDIENCE, scope: READ };
