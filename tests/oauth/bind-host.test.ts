import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn, execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * MECHANICAL_SECURITY_FIX discriminator — AUTH_HTTP_BIND_HOST.
 *
 * The frozen hosting topology (AUTH_SERVICE_MOBILE_PUBLIC_HOSTING_V1)
 * requires MAC_AUTH_SERVICE_LISTEN = LOOPBACK_ONLY: the old code called
 * app.listen(env.PORT, …) which binds the wildcard address. Each case boots
 * the REAL server module in a child process (it listens at import time) on a
 * chosen free port and asserts the resulting listener address via lsof.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tsx = path.join(repoRoot, 'node_modules', '.bin', 'tsx');

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

function listeningAddresses(port: number): Promise<string[]> {
  return new Promise((resolve, reject) => {
    execFile('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], (err, stdout) => {
      const out: string[] = [];
      for (const line of (stdout ?? '').split('\n').slice(1)) {
        const cols = line.trim().split(/\s+/);
        if (cols.length > 8) out.push(cols[8]);
      }
      if (err && !out.length) return reject(err);
      resolve(out);
    });
  });
}

interface Booted {
  port: number;
  addresses: () => Promise<string[]>;
  stop: () => void;
}

async function bootServer(extraEnv: Record<string | symbol, string | undefined>): Promise<Booted> {
  const port = await freePort();
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    AUTH_CONTRACT_MODE: 'v0',
    JWT_SECRET: 'test-jwt-secret',
    PORT: String(port),
    ...extraEnv,
  };
  const child = spawn(tsx, [path.join(repoRoot, 'src', 'server.ts')], {
    env,
    stdio: 'ignore',
  });
  // wait until the listener appears
  const deadline = Date.now() + 15000;
  let addrs: string[] = [];
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 400));
    try {
      addrs = await listeningAddresses(port);
    } catch {
      addrs = [];
    }
    if (addrs.length) break;
  }
  return {
    port,
    addresses: () => listeningAddresses(port),
    stop: () => child.kill('SIGKILL'),
  };
}

test('AUTH_HTTP_BIND_HOST=127.0.0.1 yields a loopback-only listener', async (t) => {
  const booted = await bootServer({ AUTH_HTTP_BIND_HOST: '127.0.0.1' });
  t.after(booted.stop);
  const addrs = await booted.addresses();
  assert.ok(addrs.length >= 1, `expected a listener on ${booted.port}, got none`);
  for (const addr of addrs) {
    assert.match(addr, /^127\.0\.0\.1:/, `listener must be loopback-only, got ${addr}`);
    assert.doesNotMatch(addr, /^\*:/, 'wildcard listener forbidden');
    assert.doesNotMatch(addr, /^0\.0\.0\.0:/, '0.0.0.0 listener forbidden');
    assert.doesNotMatch(addr, /^\[::\]/, '[::] listener forbidden');
  }
});

test('default (unset) AUTH_HTTP_BIND_HOST also binds loopback only', async (t) => {
  const booted = await bootServer({ AUTH_HTTP_BIND_HOST: undefined });
  t.after(booted.stop);
  const addrs = await booted.addresses();
  assert.ok(addrs.length >= 1, `expected a listener on ${booted.port}, got none`);
  for (const addr of addrs) assert.match(addr, /^127\.0\.0\.1:/, `got ${addr}`);
});
