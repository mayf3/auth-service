#!/usr/bin/env bash
# Only self-owned disposable PostgreSQL; no production supply entrypoint is run.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
if (($# != 0)) || [[ ${DATABASE_URL+x} || ${DIRECT_URL+x} || ${AUTH_DATABASE_URL+x} || ${NDG_TEST_DATABASE_URL+x} ]]; then
  echo 'REFUSED: external database inputs or arguments' >&2
  exit 2
fi
pgbin=/opt/homebrew/opt/postgresql@16/bin
[[ -x "$pgbin/initdb" && -x "$pgbin/pg_ctl" && -x "$pgbin/psql" ]] || { echo 'NOT_RUN: PostgreSQL16 unavailable' >&2; exit 3; }
node scripts/prepare-minimal-auth-v1.mjs >/dev/null
fixture=$(mktemp -d /private/tmp/ndg-typecheck-XXXXXXXX)
trap 'rm -rf "$fixture"' EXIT
node - "$PWD" "$fixture" <<'JS'
const fs=require('fs'),path=require('path');const [repo,tmp]=process.argv.slice(2);
fs.writeFileSync(path.join(tmp,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',strict:true,esModuleInterop:true,skipLibCheck:true,resolveJsonModule:true,noEmit:true,rootDir:repo,typeRoots:[repo+'/node_modules/@types'],types:['node']},files:[repo+'/scripts/supply-notification-deliver-v1.ts',repo+'/tests/oauth/supply-notification-deliver-v1.test.ts']}));
JS
node_modules/.bin/tsc -p "$fixture/tsconfig.json"
env -i PATH="$PATH" LC_ALL=C NDG_PG_BIN="$pgbin" node --import tsx --test --test-reporter=tap tests/oauth/supply-notification-deliver-v1.test.ts
echo 'NOTIFICATION_DELIVER_CONFORMANCE=PASS; PRODUCTION_WRITES=0; MINT_DELIVER_NOT_EXECUTED'
