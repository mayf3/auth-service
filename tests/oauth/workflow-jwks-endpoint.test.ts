/**
 * JWKS endpoint tests (plan §12.4, §12.8; task spec §七, §十四 JWKS).
 *
 * Spins up the route on an ephemeral port over node:http (mirrors
 * local-smoke.mjs — no supertest dependency). Verifies response shape,
 * no private params, cache headers, ETag.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { wellKnownRouter, resetJwksCacheForTests } from '../../src/routes/well-known.js';
import { resetWorkflowKeyringForTests } from '../../src/lib/oauth/workflow-keyring.js';
import {
  generateTestKeyPair,
  configureKeyringEnv,
  clearKeyringEnv,
} from './_workflow-test-keys.js';

const ORIGINAL_ENV = { ...process.env };

interface Resp {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

async function getJwks(port: number): Promise<Resp> {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${port}/.well-known/jwks.json`, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', reject);
  });
}

function startServer(): Promise<http.Server> {
  return new Promise((resolve) => {
    const app = express();
    app.use('/.well-known', wellKnownRouter);
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function portOf(server: http.Server): number {
  return (server.address() as AddressInfo).port;
}

describe('GET /.well-known/jwks.json', () => {
  let server: http.Server;
  beforeEach(async () => {
    const active = generateTestKeyPair('key-v1-20260716', 2048);
    configureKeyringEnv({ activeKid: active.kid, activePrivateKeyPem: active.privateKeyPem });
    resetWorkflowKeyringForTests();
    resetJwksCacheForTests();
    server = await startServer();
  });
  afterEach(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    clearKeyringEnv();
    resetWorkflowKeyringForTests();
    resetJwksCacheForTests();
    for (const k of Object.keys(process.env)) if (!(k in ORIGINAL_ENV)) delete process.env[k];
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it('returns 200', async () => {
    const res = await getJwks(portOf(server));
    assert.equal(res.statusCode, 200);
  });

  it('publishes the active public key with correct metadata', async () => {
    const res = await getJwks(portOf(server));
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.keys));
    assert.equal(body.keys.length, 1);
    const k = body.keys[0];
    assert.equal(k.kty, 'RSA');
    assert.equal(k.use, 'sig');
    assert.equal(k.alg, 'RS256');
    assert.equal(k.kid, 'key-v1-20260716');
    assert.equal(k.e, 'AQAB');
    assert.ok(typeof k.n === 'string' && k.n.length > 0);
  });

  it('NEVER publishes private parameters (d/p/q/dp/dq/qi)', async () => {
    const res = await getJwks(portOf(server));
    const body = JSON.parse(res.body);
    for (const k of body.keys) {
      for (const priv of ['d', 'p', 'q', 'dp', 'dq', 'qi']) {
        assert.equal(k[priv], undefined, `JWKS must not expose ${priv}`);
      }
    }
  });

  it('sets Cache-Control (public, max-age) and ETag', async () => {
    const res = await getJwks(portOf(server));
    const cc = res.headers['cache-control'];
    assert.ok(cc, 'Cache-Control header present');
    assert.match(cc, /public/i);
    assert.match(cc, /max-age=\d+/);
    assert.ok(res.headers.etag, 'ETag present');
  });
});

