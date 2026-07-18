# Minimal Auth V1 Contract Bundle — Independent Review

> Review date: 2026-07-18 (Asia/Shanghai)
> Review mode: independent, read-only, remote detached checkout

## Reviewed object

```text
REMOTE=ssh://root@8.163.44.127/opt/git/auth-service.git
HEAD_SHA=62ad3ec89c52e0fc4936279c23d2346706b948fa
TREE_SHA=9347e9297fefaad7bcd0347637336df0c39bc03c
REMOTE_OBJECT_VERIFIED=true
DETACHED_TRACKED_WORKTREE_CLEAN=true
```

## Verdict

```text
AUTH_TOKEN_CONTRACT_V1_BUNDLE_REVIEW_PASS=true
CONTRACT_BUNDLE_FREEZE=REVIEW_PASS_PENDING_FREEZE_TRANSITION
BLOCKER=0
HIGH=0
MEDIUM=1

PRODUCTION_JWKS_DEPLOYMENT_READY=false
AUTH_TOKEN_CONTRACT_V1_PRODUCTION_EFFECTIVE=false
CONSUMER_MIGRATION_IN_SCOPE_READY=false
LEGACY_CONSUMERS_MIGRATED=false
```

The review authorizes a source Contract Bundle freeze transition. It does not
attest production deployment, a production JWKS URL, consumer migration or V0
supersession.

## Closed findings

The reviewer confirmed that all three Blockers and four High findings from the
first review are closed:

- Contract Bundle Freeze, Production Deployment and Consumer Migration have
  independent states and gates.
- First-wave scope is exactly `auth-service`, `svc-workflow`, `svc-okr` and
  `adc-v2`; Legacy repositories cannot block source Bundle Freeze.
- Token Exchange preserves the V0 `audience` request parameter.
- Exchange Audit Schema represents both `result=success` and
  `result=rejected` records.
- Direct and OBO fixtures bind issued Scope to an independent requested Scope
  and reject partial authorization or silent downscope.
- Public-only JWKS and compact JWT fixtures perform real RS256 verification and
  reject bad signatures, HS256 confusion and unknown `kid`.
- Eight Draft 2020-12 schemas compile and validate the Manifest, Registry and
  eighteen representative instances.
- Real-process Human Session/Refresh Conformance follows implementation and no
  longer blocks the initial source Bundle Freeze.

## Independent evidence

```text
MINIMAL_AUTH_V1_BUNDLE_VALID=true
SCHEMA_COUNT=8
SCHEMA_INSTANCE_COUNT=18
POSITIVE_FIXTURE_COUNT=4
NEGATIVE_FIXTURE_COUNT=17
ALL_CONTRACT_BUNDLE_FILES_LE_500=true
BUILD_PASS=true
```

The reviewer also fetched and matched the first-wave consumer objects:

```text
svc-workflow  93d81f5fdab00dd6e04e22b5e16816213b317ec5
              a19642cbd2d814aa045f22afa8e29ee98f4beab7
svc-okr       19781e46f35d10f1cd3148375752b03dd32ec1fc
              eb39002085059db5ae4a3451fa7a68517a6462cb
adc-v2        ddeeab2ff394af64b78d9820c9e64d5bf0952ebd
              6b7e69217cac99b381876e85750dea588ae501fd
```

## Medium disposition

The only Medium was an obsolete Bundle README reference to `bundle_status`.
The freeze transition corrects it to
`lifecycle.contract_bundle_freeze.status`. The frozen transition commit is a
new object and must pass a new exact-SHA independent review before
implementation starts.
