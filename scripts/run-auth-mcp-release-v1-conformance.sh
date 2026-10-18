#!/usr/bin/env bash
# Only disposable compiled graph, PostgreSQL and OS fixtures. Never a release writer.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
if [[ -n "${DATABASE_URL-}${DIRECT_URL-}${MCR_TEST_ROOT-}${MCR_TEST_DATABASE_URL-}" ]]; then
  echo 'REFUSED: ambient database/fixture input'; exit 2
fi
[[ $(id -u) == 502 && $(id -g) == 20 ]] || { echo 'NOT_RUN: existing UID502/GID20 fixture required'; exit 3; }
sudo -n true || { echo 'NOT_RUN: disposable OS privilege unavailable'; exit 3; }
pgbin=/opt/homebrew/opt/postgresql@16/bin
[[ -x "$pgbin/initdb" ]] || { echo 'NOT_RUN: PostgreSQL16 unavailable'; exit 3; }
fixture=$(mktemp -d /private/tmp/mcr-conformance-XXXXXXXX)
chmod 755 "$fixture"
cleanup() {
  result=$?
  trap - EXIT
  "$pgbin/pg_ctl" -D "$fixture/pg" -m immediate -w stop >/dev/null 2>&1 || true
  echo "MCR_FIXTURE_RETAINED=$fixture EXIT=$result REASON=isolated_compiled_graph_and_fault_evidence_no_production_effects"
  exit "$result"
}
trap cleanup EXIT
mkdir "$fixture/artifact"
chmod 755 "$fixture/artifact"
node - "$PWD" "$fixture" <<'JS'
const fs=require('fs'),path=require('path');const [repo,fixture]=process.argv.slice(2);
const config={compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',strict:true,esModuleInterop:true,skipLibCheck:true,resolveJsonModule:true,noEmitOnError:true,rootDir:repo,outDir:path.join(fixture,'artifact/dist')},include:[repo+'/src/**/*.ts',repo+'/scripts/start-auth-mcp-release-v1.ts',repo+'/scripts/supply-mcp-conversation-pilot-v1.ts']};
fs.writeFileSync(path.join(fixture,'tsconfig.json'),JSON.stringify(config));
JS
node_modules/.bin/tsc -p "$fixture/tsconfig.json" --noEmitOnError
cp package.json "$fixture/artifact/package.json"
cp -R generated "$fixture/artifact/generated"
ln -s "$PWD/node_modules" "$fixture/artifact/node_modules"
chmod -R a+rX "$fixture/artifact"
port=$(/usr/bin/python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()')
[[ "$port" -ge 20000 ]] || exit 3
"$pgbin/initdb" -D "$fixture/pg" --auth=trust --username=yanfenma --no-locale --encoding=UTF8 >/dev/null
mkdir "$fixture/socket"
"$pgbin/pg_ctl" -D "$fixture/pg" -l "$fixture/postgres.log" -o "-h 127.0.0.1 -p $port -k $fixture/socket -c fsync=on -c log_statement=none" -w start >/dev/null
"$pgbin/createdb" -h 127.0.0.1 -p "$port" -U yanfenma mcr_disposable
url="postgresql://yanfenma@127.0.0.1:$port/mcr_disposable"
DATABASE_URL="$url" node_modules/.bin/prisma db push --skip-generate >/dev/null
sudo -n /usr/bin/env MCR_OS_FIXTURE=1 MCR_TEST_ROOT="$fixture" MCR_COMPILED_WRAPPER="$fixture/artifact/dist/scripts/start-auth-mcp-release-v1.js" MCR_TEST_DATABASE_URL="$url" "$(command -v node)" --import tsx --test tests/oauth/auth-mcp-release-v1.test.ts
