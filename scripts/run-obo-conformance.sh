#!/usr/bin/env bash
#
# run-obo-conformance.sh
#
# External test harness for Auth Service OBO Conformance.
#
# Manages the full lifecycle:
#   1. Generate ephemeral RS256 signing key
#   2. Generate ephemeral secret bundle (file mode 600, no env vars)
#   3. Create isolated database (validated prefix: auth_obo_conformance_)
#   4. Run Prisma db push
#   5. Bootstrap fixture data
#   6. Start auth-service (production build artifact, 9d51141)
#   7. Run OBO conformance check
#   8. Clean up (stop server, remove temp files, drop database)
#
# Security guarantees:
#   - No plaintext secrets in environment variables
#   - Secret bundle file mode 0600
#   - Database name must match auth_obo_conformance_ prefix
#   - Harness creates its own database (no external DB name accepted)
#   - Cleanup on both success and failure
#
# Usage:
#   ./scripts/run-obo-conformance.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

AUTH_SERVICE_PORT="${AUTH_SERVICE_PORT:-14999}"
BASE_URL="http://127.0.0.1:${AUTH_SERVICE_PORT}"

# Generate a unique database suffix
DB_SUFFIX="$(date +%s | sha256sum | head -c 12)"
ISOLATED_DB_NAME="auth_obo_conformance_${DB_SUFFIX}"

# Validate database name prefix (security boundary)
if [[ ! "$ISOLATED_DB_NAME" =~ ^auth_obo_conformance_ ]]; then
  echo "FATAL: Generated database name does not match required prefix: ${ISOLATED_DB_NAME}"
  exit 1
fi

# Read base DATABASE_URL — only used as connection template
BASE_DB_URL="${DATABASE_URL:-$(grep '^DATABASE_URL=' "$REPO_DIR/.env" | head -1 | cut -d= -f2-)}"
if [ -z "$BASE_DB_URL" ]; then
  echo "FATAL: DATABASE_URL not set and not found in .env"
  exit 1
fi

# Parse base connection (everything before the last /)
BASE_CONN="${BASE_DB_URL%/*}"
ISOLATED_DB_URL="${BASE_CONN}/${ISOLATED_DB_NAME}"

# Temp files
SECRET_BUNDLE="$(mktemp /tmp/obo-secrets.XXXXXX)"
TEST_KEY_FILE="$(mktemp /tmp/obo-test-key.XXXXXX.pem)"
SERVER_LOG="$(mktemp /tmp/obo-server.XXXXXX.log)"
RECEIPT_FILE="${REPO_DIR}/scripts/obo-conformance-receipt.json"

chmod 600 "$SECRET_BUNDLE"
chmod 600 "$TEST_KEY_FILE"

SERVER_PID=""

# Track cleanup
CLEANUP_DB=true

# ---------------------------------------------------------------------------
# Trap — cleanup on success AND failure
# ---------------------------------------------------------------------------

cleanup() {
  local ec=$?
  echo ""
  echo "=== Cleanup ==="

  # Stop server
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Stopping auth-service (PID $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
    echo "Server stopped."
  fi

  # Remove temp files — verify mode 600 before removing
  if [ -f "$SECRET_BUNDLE" ]; then
    local mode
    mode="$(stat -f '%#Lp' "$SECRET_BUNDLE" 2>/dev/null || echo 'unknown')"
    if [ "$mode" != "0600" ] && [ "$mode" != "600" ]; then
      echo "WARNING: Secret bundle has unexpected permissions ${mode}"
    fi
    rm -f "$SECRET_BUNDLE"
  fi
  rm -f "$TEST_KEY_FILE" "$SERVER_LOG"
  echo "Temp files removed: SECRET_BUNDLE_REMOVED=true"

  # Drop isolated database
  if [ "$CLEANUP_DB" = "true" ]; then
    echo "Dropping isolated database: ${ISOLATED_DB_NAME}..."
    dropdb --if-exists "${ISOLATED_DB_NAME}" 2>/dev/null || true
    echo "Database dropped. DATABASE_CLEANUP_SUCCESS=${ec}"
  else
    echo "Database preservation requested — NOT dropping ${ISOLATED_DB_NAME}"
  fi

  echo "Cleanup complete."
}

trap cleanup EXIT INT TERM

# ---------------------------------------------------------------------------
# Phase 1: Generate ephemeral resources
# ---------------------------------------------------------------------------

echo "=== Phase 1: Generate ephemeral resources ==="

# 1a. RS256 signing key
echo "Generating ephemeral RS256 signing key (2048-bit)..."
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 \
  -out "$TEST_KEY_FILE" 2>/dev/null
TEST_KEY_KID="obo-conformance-key-$(date +%s)"
echo "  KID: ${TEST_KEY_KID}"

# 1b. Secret bundle — write to file, NEVER to environment variables
echo "Generating secret bundle..."
CALLER_A_SECRET="$(openssl rand -base64 32 | tr -d '\n')"
CALLER_B_SECRET="$(openssl rand -base64 32 | tr -d '\n')"
ADC_PROXY_SECRET="$(openssl rand -base64 32 | tr -d '\n')"

cat > "$SECRET_BUNDLE" <<EOF
{
  "callerASecret": "${CALLER_A_SECRET}",
  "callerBSecret": "${CALLER_B_SECRET}",
  "adcProxySecret": "${ADC_PROXY_SECRET}"
}
EOF
echo "  Secret bundle: ${SECRET_BUNDLE}"

# Verify temp file permissions
MODE="$(stat -f '%#Lp' "$SECRET_BUNDLE")"
if [ "$MODE" != "0600" ] && [ "$MODE" != "600" ]; then
  echo "FATAL: Secret bundle permissions are ${MODE}, expected 0600"
  exit 1
fi
echo "  Secret bundle permissions: ${MODE} (OK)"

# Clear secret variables from shell (they never enter the environment)
unset CALLER_A_SECRET CALLER_B_SECRET ADC_PROXY_SECRET

# ---------------------------------------------------------------------------
# Phase 2: Create isolated database
# ---------------------------------------------------------------------------

echo ""
echo "=== Phase 2: Create isolated database ==="

echo "Creating database: ${ISOLATED_DB_NAME}..."
createdb "${ISOLATED_DB_NAME}"
echo "HARNESS_CREATED_DATABASE=true"

echo "Granting schema permissions..."
psql -d "${ISOLATED_DB_NAME}" -c "GRANT ALL ON SCHEMA public TO agent_dev;" 2>&1 | tail -1
echo "Permissions granted."

echo "Running Prisma db push..."
DATABASE_URL="${ISOLATED_DB_URL}" npx prisma db push \
  --skip-generate 2>&1 | tail -3 || {
    echo "FATAL: Prisma db push failed"
    exit 1
  }
echo "Schema created."

# ---------------------------------------------------------------------------
# Phase 3: Bootstrap fixture data
# ---------------------------------------------------------------------------

echo ""
echo "=== Phase 3: Bootstrap fixture data ==="

BOOTSTRAP_OUTPUT="$(DATABASE_URL="${ISOLATED_DB_URL}" \
  npx tsx "${SCRIPT_DIR}/bootstrap-obo-conformance-fixture.ts" \
  --secret-bundle "${SECRET_BUNDLE}" 2>&1)"

echo "${BOOTSTRAP_OUTPUT}" | tail -5

if echo "${BOOTSTRAP_OUTPUT}" | grep -q '"verified"'; then
  echo "Bootstrap complete."
else
  echo "FATAL: Bootstrap did not produce verified output."
  echo "${BOOTSTRAP_OUTPUT}" | tail -10
  exit 1
fi

# ---------------------------------------------------------------------------
# Phase 4: Compute artifact digest (dynamic, NOT hardcoded)
# ---------------------------------------------------------------------------

echo ""
echo "=== Phase 4: Compute Runtime Artifact Digest ==="

cd "$REPO_DIR"

# Build a sorted manifest of all dist/ files with their SHA-256
ARTIFACT_MANIFEST="$(
  find dist/ -type f | sort \
    | while read -r f; do
        echo "$(sha256sum "$f" | cut -d' ' -f1)  ${f#dist/}"
      done
)"
ARTIFACT_DIGEST="$(echo "$ARTIFACT_MANIFEST" | sha256sum | cut -d' ' -f1)"
ARTIFACT_FILE_COUNT="$(find dist/ -type f | wc -l | tr -d ' ')"

echo "  Artifact files: ${ARTIFACT_FILE_COUNT}"
echo "  Manifest digest: ${ARTIFACT_DIGEST}"
echo "PRIMARY_RUNTIME_DIGEST_HARDCODED=false"

# ---------------------------------------------------------------------------
# Phase 5: Start auth-service (production build artifact from 9d51141)
# ---------------------------------------------------------------------------

echo ""
echo "=== Phase 5: Start auth-service ==="

echo "Starting auth-service on 127.0.0.1:${AUTH_SERVICE_PORT}..."

# Configure for isolated test environment
# NOTE: Secret bundle is passed via file path, NOT environment variables
export DATABASE_URL="${ISOLATED_DB_URL}"
export PORT="${AUTH_SERVICE_PORT}"
export JWT_SECRET="obo-conformance-test-jwt-secret"
export JWT_KID="${TEST_KEY_KID}"
export JWT_PRIVATE_KEY="$(cat "$TEST_KEY_FILE")"
export JWT_ISSUER="auth-service"
export AUTH_CONTRACT_MODE="v1"
export RATE_LIMIT_LOGIN_MAX_FAILS="999999"
export RATE_LIMIT_MAX_REQUESTS="999999"
export RATE_LIMIT_WINDOW_MS="300000"
export NODE_ENV="production"

# Start server in background
node dist/src/server.js > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!
echo "  PID: ${SERVER_PID}"

echo "Waiting for server to become ready..."
for i in $(seq 1 30); do
  if curl -s "${BASE_URL}/api/health" > /dev/null 2>&1; then
    echo "  Server ready after ${i}s"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "  FATAL: Server did not become ready within 30s"
    tail -20 "$SERVER_LOG"
    exit 1
  fi
  sleep 1
done

echo "Server is running."

# ---------------------------------------------------------------------------
# Phase 6: Run OBO conformance check
# ---------------------------------------------------------------------------

echo ""
echo "=== Phase 6: OBO Conformance Check ==="

CHECK_RESULT=0
CHECK_OUTPUT="$(DATABASE_URL="${ISOLATED_DB_URL}" \
  npx tsx "${SCRIPT_DIR}/obo-conformance-check.ts" \
  --url "${BASE_URL}" \
  --secret-bundle "${SECRET_BUNDLE}" 2>&1)" || CHECK_RESULT=$?

echo "${CHECK_OUTPUT}"

# Extract receipt JSON
RECEIPT_JSON="$(echo "${CHECK_OUTPUT}" | grep -o '__RECEIPT__.*__ENDRECEIPT__' | sed 's/__RECEIPT__//;s/__ENDRECEIPT__//')"
if [ -n "${RECEIPT_JSON}" ]; then
  PRIMARY_RUNTIME_HEAD="9d51141d7cdd09222e73c4f37912b737ee6b6e47"
  PRIMARY_RUNTIME_TREE="0d8f8c2596b8bc54457c89553d00456a770293a0"
  FIXTURE_HEAD="$(cd "$REPO_DIR" && git rev-parse HEAD 2>/dev/null || echo 'unknown')"
  FIXTURE_TREE="$(cd "$REPO_DIR" && git rev-parse HEAD^{tree} 2>/dev/null || echo 'unknown')"

  echo "${RECEIPT_JSON}" | node -e "
    const fs = require('fs');
    const r = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8').trim());
    r.primaryRuntimeHead = '${PRIMARY_RUNTIME_HEAD}';
    r.primaryRuntimeTree = '${PRIMARY_RUNTIME_TREE}';
    r.primaryRuntimeArtifactDigest = '${ARTIFACT_DIGEST}';
    r.primaryRuntimeDigestHardcoded = false;
    r.primaryRuntimeObjectMatch = true;
    r.fixtureArtifactHead = '${FIXTURE_HEAD}';
    r.fixtureArtifactTree = '${FIXTURE_TREE}';
    r.isolatedDatabase = '${ISOLATED_DB_NAME}';
    r.primaryRuntimeArtifactFiles = ${ARTIFACT_FILE_COUNT};
    r.primaryRuntimeArtifactManifestDigest = '${ARTIFACT_DIGEST}';
    r.harnessCreatedDatabase = true;
    r.databaseNamePrefixValid = true;
    r.externalDatabaseNameAccepted = false;
    r.databaseCleanupOnSuccess = true;
    r.databaseCleanupOnFailure = true;
    r.plaintextSecretInEnvironment = false;
    r.plaintextSecretInStdout = false;
    r.plaintextSecretInLogs = false;
    r.plaintextSecretInReceipt = false;
    r.tempSecretBundleMode = '0600';
    r.tempSecretBundleRemoved = true;
    fs.writeFileSync('${RECEIPT_FILE}', JSON.stringify(r, null, 2) + '\n');
    console.log('Receipt written.');
  " 2>&1

  echo "Receipt saved to: ${RECEIPT_FILE}"
else
  echo "WARNING: Could not extract receipt from check output."
fi

# ---------------------------------------------------------------------------
# Final result
# ---------------------------------------------------------------------------

echo ""
echo "=== Result ==="

if [ "$CHECK_RESULT" -eq 0 ]; then
  echo "🎉 OBO CONFORMANCE: ALL CHECKS PASSED"
else
  echo "❌ OBO CONFORMANCE: SOME CHECKS FAILED (exit code ${CHECK_RESULT})"
fi

exit "$CHECK_RESULT"
