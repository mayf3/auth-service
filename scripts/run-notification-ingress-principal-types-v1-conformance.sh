#!/usr/bin/env bash
# Synthetic fixture only; no external database inputs and no production operation.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
if (($# != 0)) || [[ ${DATABASE_URL+x} || ${DIRECT_URL+x} || ${AUTH_DATABASE_URL+x} || ${NIR_TEST_DATABASE_URL+x} || ${NDG_TEST_DATABASE_URL+x} ]]; then
  echo 'REFUSED: external database inputs or arguments' >&2
  exit 2
fi
pgbin=/opt/homebrew/opt/postgresql@16/bin
[[ -x "$pgbin/initdb" && -x "$pgbin/pg_ctl" && -x "$pgbin/psql" ]] || { echo 'NOT_RUN: PostgreSQL16 unavailable' >&2; exit 3; }
fixture=$(mktemp -d /private/tmp/nir-typecheck-XXXXXXXX)
trap 'rm -rf "$fixture"' EXIT
node - "$PWD" "$fixture" <<'JS'
const fs=require('fs'),path=require('path');const [repo,tmp]=process.argv.slice(2);
fs.writeFileSync(path.join(tmp,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',strict:true,esModuleInterop:true,skipLibCheck:true,resolveJsonModule:true,noEmit:true,rootDir:repo,typeRoots:[repo+'/node_modules/@types'],types:['node']},files:[repo+'/scripts/reconcile-notification-ingress-principal-types-v1.ts',repo+'/tests/oauth/reconcile-notification-ingress-principal-types-v1.test.ts']}));
JS
node_modules/.bin/tsc -p "$fixture/tsconfig.json"
env -i PATH="$PATH" LC_ALL=C TSX_DISABLE_CACHE=1 NIR_PG_BIN="$pgbin" node --import tsx --test --test-reporter=tap tests/oauth/reconcile-notification-ingress-principal-types-v1.test.ts
echo 'NOTIFICATION_INGRESS_PRINCIPAL_TYPES_CONFORMANCE=PASS; PRODUCTION_WRITES=0; MINT_DELIVER_NOT_EXECUTED'
