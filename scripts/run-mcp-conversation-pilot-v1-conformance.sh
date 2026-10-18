#!/usr/bin/env bash
# Disposable local PostgreSQL and actual UID/root-owned private-file conformance only.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
if [[ -n "${DATABASE_URL-}" || -n "${DIRECT_URL-}" || -n "${AUTH_DATABASE_URL-}" || -n "${MCS_TEST_DATABASE_URL-}" || -n "${MCS_TEST_ROOT-}" ]]; then
  echo 'REFUSED: ambient database/fixture coordinates are forbidden' >&2
  exit 2
fi
if [[ "$(id -u)" != 502 || "$(id -g)" != 20 ]]; then
  echo 'NOT_RUN: isolated OS fixture requires existing UID502/GID20 actor' >&2
  exit 3
fi
for exe in /usr/bin/python3 node node_modules/.bin/tsx node_modules/.bin/prisma; do
  command -v "$exe" >/dev/null || { echo 'NOT_RUN: missing conformance prerequisite' >&2; exit 3; }
done
sudo -n true || { echo 'NOT_RUN: existing root delivery privilege unavailable' >&2; exit 3; }
pgbin=/opt/homebrew/opt/postgresql@16/bin
[[ -x "$pgbin/initdb" && -x "$pgbin/pg_ctl" ]] || { echo 'NOT_RUN: PostgreSQL16 prerequisite unavailable' >&2; exit 3; }
source_commit=$(git rev-parse HEAD)
fixture=$(mktemp -d /private/tmp/mcs-conformance-XXXXXXXX)
cleanup() {
  result=$?
  trap - EXIT
  postgres_stopped=false
  fixture_removed=false
  fixture_bytes_before=0
  fixture_bytes_after=0
  "$pgbin/pg_ctl" -D "$fixture/pg" -m immediate stop >/dev/null 2>&1 || true
  if ! "$pgbin/pg_ctl" -D "$fixture/pg" status >/dev/null 2>&1; then postgres_stopped=true; fi
  if [[ -d "$fixture" && ! -L "$fixture" ]]; then
    fixture_bytes_before=$(sudo -n /usr/bin/python3 -c 'import os,sys;total=0
for root,dirs,files in os.walk(sys.argv[1],followlinks=False):
 for name in files:
  total+=os.lstat(os.path.join(root,name)).st_size
print(total)' "$fixture")
  fi
  # Successful isolated tests prove terminal DB states before fixture teardown.
  # On test failure retain the private tree/DB for authorized diagnosis; no fence deletion.
  if [[ "$result" -eq 0 && "$postgres_stopped" == true && "$fixture" == /private/tmp/mcs-conformance-* && -f "$fixture/runner-owned" ]]; then
    sudo -n /bin/rm -rf -- "$fixture"
    [[ ! -e "$fixture" ]] && fixture_removed=true
  fi
  if [[ "$fixture_removed" != true ]]; then fixture_bytes_after=$fixture_bytes_before; fi
  /usr/bin/python3 -c 'import json,sys;print(json.dumps({"schema_version":1,"environment":"isolated-conformance","command":"bash scripts/run-mcp-conversation-pilot-v1-conformance.sh","test_exit_code":int(sys.argv[1]),"postgres_stopped":sys.argv[2]=="true","fixture_removed":sys.argv[3]=="true","owned_fixture":sys.argv[4],"fixture_bytes_before":int(sys.argv[5]),"fixture_bytes_after":int(sys.argv[6]),"source_commit":sys.argv[7],"production_touched":False,"live_credential_acceptance":"NOT_RUN"}))' "$result" "$postgres_stopped" "$fixture_removed" "$fixture" "$fixture_bytes_before" "$fixture_bytes_after" "$source_commit"
  exit "$result"
}
trap cleanup EXIT
: > "$fixture/runner-owned"
port=$(/usr/bin/python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));p=s.getsockname()[1];s.close();print(p)')
[[ "$port" -ge 20000 ]] || { echo 'NOT_RUN: ephemeral port outside isolated range'; exit 3; }
"$pgbin/initdb" -D "$fixture/pg" --auth=trust --username=yanfenma --no-locale --encoding=UTF8 >/dev/null
mkdir "$fixture/socket"
"$pgbin/pg_ctl" -D "$fixture/pg" -l "$fixture/postgres.log" -o "-h 127.0.0.1 -p $port -k $fixture/socket -c fsync=on -c log_statement=none" -w start >/dev/null
name="mcs_$(node -e 'process.stdout.write(require("node:crypto").randomUUID().replaceAll("-",""))')"
"$pgbin/createdb" -h 127.0.0.1 -p "$port" -U yanfenma "$name"
url="postgresql://yanfenma@127.0.0.1:$port/$name"
DATABASE_URL="$url" node_modules/.bin/prisma db push --skip-generate >/dev/null
# Variables describe only this newly created cluster/tree; no credentials are involved.
sudo -n /usr/bin/env MCS_TEST_ROOT="$fixture" MCS_TEST_DATABASE_URL="$url" MCS_TEST_SOURCE_COMMIT="$source_commit" \
  "$(command -v node)" --import tsx --test tests/oauth/supply-mcp-conversation-pilot-v1.test.ts
