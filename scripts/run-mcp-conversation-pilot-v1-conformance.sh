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
fixture_identity=$(/usr/bin/python3 -c 'import os,sys,json;s=os.lstat(sys.argv[1]);print(json.dumps({"dev":s.st_dev,"ino":s.st_ino,"uid":s.st_uid,"gid":s.st_gid,"mode":s.st_mode&0o777}))' "$fixture")
cleanup() {
  result=$?
  trap - EXIT
  postgres_stopped=false
  "$pgbin/pg_ctl" -D "$fixture/pg" -m immediate stop >/dev/null 2>&1 || true
  if ! "$pgbin/pg_ctl" -D "$fixture/pg" status >/dev/null 2>&1; then postgres_stopped=true; fi
  # Metadata only. Bounded lsof checks this exact fixture after all test/PG processes end.
  # Any missing provenance, symlink, active FD or failed test retains the private tree.
  sudo -n /usr/bin/python3 - "$fixture" "$fixture_identity" "$result" "$postgres_stopped" "$source_commit" <<'PY_CLEANUP'
import os,sys,json,stat,subprocess,shutil
path,identity,result,stopped,source=sys.argv[1:]; expected=json.loads(identity); result=int(result)
r={"schema_version":1,"environment":"isolated-conformance","command":"bash scripts/run-mcp-conversation-pilot-v1-conformance.sh","test_exit_code":result,"source_commit":source,"owned_fixture":path,"postgres_stopped":stopped=="true","fixture_removed":False,"ownership_inode_verified":False,"active_fd_check":"UNKNOWN","cleanup_reason":"RETAINED","byte_basis":"logical file st_size; allocated all entries st_blocks*512","fixture_bytes_before":0,"fixture_bytes_after":0,"fixture_allocated_bytes_before":0,"fixture_allocated_bytes_after":0,"production_touched":False,"live_credential_acceptance":"NOT_RUN"}
try:
 s=os.lstat(path); actual={"dev":s.st_dev,"ino":s.st_ino,"uid":s.st_uid,"gid":s.st_gid,"mode":stat.S_IMODE(s.st_mode)}
 if not stat.S_ISDIR(s.st_mode) or os.path.realpath(path)!=path or actual!=expected or expected['uid']!=502 or not path.startswith('/private/tmp/mcs-conformance-'): raise RuntimeError()
 marker=os.lstat(os.path.join(path,'runner-owned'))
 if not stat.S_ISREG(marker.st_mode) or marker.st_uid!=502 or marker.st_nlink!=1 or stat.S_IMODE(marker.st_mode)!=0o600: raise RuntimeError()
 r['ownership_inode_verified']=True
 logical=0; allocated=0
 for root,dirs,files in os.walk(path,followlinks=False):
  allocated+=os.lstat(root).st_blocks*512
  for name in files+[n for n in dirs if os.path.islink(os.path.join(root,n))]:
   st=os.lstat(os.path.join(root,name)); logical+=st.st_size; allocated+=st.st_blocks*512
 r['fixture_bytes_before']=r['fixture_bytes_after']=logical
 r['fixture_allocated_bytes_before']=r['fixture_allocated_bytes_after']=allocated
 fds=subprocess.run(['/usr/sbin/lsof','-nP','+D',path],capture_output=True,timeout=20)
 r['active_fd_check']='NONE' if fds.returncode==1 and not fds.stdout and not fds.stderr else 'PRESENT_OR_UNKNOWN'
 fresh=os.lstat(path)
 if (fresh.st_dev,fresh.st_ino,fresh.st_uid)!=(s.st_dev,s.st_ino,502): raise RuntimeError()
 if result==0 and stopped=='true' and r['active_fd_check']=='NONE' and shutil.rmtree.avoids_symlink_attacks:
  shutil.rmtree(path)
  if not os.path.lexists(path):
   r.update(fixture_removed=True,fixture_bytes_after=0,fixture_allocated_bytes_after=0,cleanup_reason='OWNED_FIXTURE_REMOVED_AFTER_PROVEN_TERMINAL_TESTS')
 else: r['cleanup_reason']='RETAINED_TEST_FAILURE_OR_UNPROVEN_NO_FD'
except BaseException:
 r['cleanup_reason']='RETAINED_UNPROVEN_CLEANUP_PRECONDITION'
print(json.dumps(r))
PY_CLEANUP
  exit "$result"
}
trap cleanup EXIT
: > "$fixture/runner-owned"
# Compile native code but exercise only pre-LA refusal: missing FD3 / wrong UID.
/usr/bin/xcrun swiftc scripts/mcp-pilot-human-auth.swift -o "$fixture/native-helper"
set +e
"$fixture/native-helper" > "$fixture/native-stdout" 2> "$fixture/native-stderr"
native_status=$?
sudo -n "$fixture/native-helper" > "$fixture/native-root-stdout" 2> "$fixture/native-root-stderr"
native_root_status=$?
set -e
[[ "$native_status" == 1 && "$native_root_status" == 1 && ! -s "$fixture/native-stdout" && ! -s "$fixture/native-stderr" && ! -s "$fixture/native-root-stdout" && ! -s "$fixture/native-root-stderr" ]]
sudo -n /usr/bin/python3 - "$fixture/native-helper" <<'PY_NATIVE'
import os,socket,subprocess,struct,sys,json
child,parent=socket.socketpair()
assert child.fileno()==3
def identity():
 os.setgroups([20]);os.setgid(20);os.setuid(502)
p=subprocess.Popen([sys.argv[1]],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,pass_fds=(3,),preexec_fn=identity,env={'PATH':'/usr/bin:/bin'})
child.close()
try: parent.sendall(struct.pack('!I',2)+b'{}'); parent.shutdown(socket.SHUT_WR)
except BrokenPipeError: pass
stdout,stderr=p.communicate(timeout=5)
assert p.returncode==1 and not stdout and not stderr
parent.close()
print('NATIVE_REAL_SOCKETPAIR_UID502_MALFORMED_REQUEST_REFUSED_BEFORE_LA')
PY_NATIVE
echo 'NATIVE_COMPILE_PASS; UID502_MISSING_FD_REFUSED; ROOT_REFUSED; LA_PROMPT_NOT_RUN'
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
  "$(command -v node)" --import tsx --test --test-name-pattern="^V2 " tests/oauth/supply-mcp-conversation-pilot-v1.test.ts
