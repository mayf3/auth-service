import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { closeSync, fstatSync, readFileSync, readSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Prisma, PrismaClient } from '@prisma/client';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Db = PrismaClient | Prisma.TransactionClient;
type Metadata = {
  migrationId: string;
  sourceGitCommit: string;
  operatorId: string;
  approvalRef: string;
  reason: string;
};
type Target = {
  agentId: string;
  clientExternalRef: string;
  principalExternalRef: string;
};
type Mapping = Readonly<Record<string, string>>;
type GrantRow = { audienceId: string; scopes: string[]; version: number };
type ClientState = {
  target: Target;
  internalClientId: string;
  publicClientId: string;
  principalId: string;
  outcome: 'create' | 'noop';
  afterValue: Prisma.InputJsonObject;
};
type FleetState = { clients: ClientState[]; nonTarget: Array<{ agentId: string; grants: GrantRow[] }> };

const TARGETS: readonly Target[] = Object.freeze([
  Object.freeze({ agentId: 'agt_ceo-agent', clientExternalRef: 'agentcore:v1:client:agt_ceo-agent', principalExternalRef: 'agentcore:v1:principal:agt_ceo-agent' }),
  Object.freeze({ agentId: 'agt_stock-agent', clientExternalRef: 'agentcore:v1:client:agt_stock-agent', principalExternalRef: 'agentcore:v1:principal:agt_stock-agent' }),
  Object.freeze({ agentId: 'agt_research-agent', clientExternalRef: 'agentcore:v1:client:agt_research-agent', principalExternalRef: 'agentcore:v1:principal:agt_research-agent' }),
  Object.freeze({ agentId: 'agt_knowledge-curator-agent', clientExternalRef: 'agentcore:v1:client:agt_knowledge-curator-agent', principalExternalRef: 'agentcore:v1:principal:agt_knowledge-curator-agent' }),
  Object.freeze({ agentId: 'agt_daily-thought-agent', clientExternalRef: 'agentcore:v1:client:agt_daily-thought-agent', principalExternalRef: 'agentcore:v1:principal:agt_daily-thought-agent' }),
  Object.freeze({ agentId: 'agt_efficiency-agent', clientExternalRef: 'agentcore:v1:client:agt_efficiency-agent', principalExternalRef: 'agentcore:v1:principal:agt_efficiency-agent' }),
  Object.freeze({ agentId: 'agt_lobster-agent', clientExternalRef: 'agentcore:v1:client:agt_lobster-agent', principalExternalRef: 'agentcore:v1:principal:agt_lobster-agent' }),
  Object.freeze({ agentId: 'agt_itops-agent', clientExternalRef: 'agentcore:v1:client:agt_itops-agent', principalExternalRef: 'agentcore:v1:principal:agt_itops-agent' }),
  Object.freeze({ agentId: 'agt_healthcheck-agent', clientExternalRef: 'agentcore:v1:client:agt_healthcheck-agent', principalExternalRef: 'agentcore:v1:principal:agt_healthcheck-agent' }),
  Object.freeze({ agentId: 'agt_hr-agent', clientExternalRef: 'agentcore:v1:client:agt_hr-agent', principalExternalRef: 'agentcore:v1:principal:agt_hr-agent' }),
  Object.freeze({ agentId: 'agt_security-agent', clientExternalRef: 'agentcore:v1:client:agt_security-agent', principalExternalRef: 'agentcore:v1:principal:agt_security-agent' }),
  Object.freeze({ agentId: 'agt_skill-engineer-agent', clientExternalRef: 'agentcore:v1:client:agt_skill-engineer-agent', principalExternalRef: 'agentcore:v1:principal:agt_skill-engineer-agent' }),
  Object.freeze({ agentId: 'agt_discipline-coach-agent', clientExternalRef: 'agentcore:v1:client:agt_discipline-coach-agent', principalExternalRef: 'agentcore:v1:principal:agt_discipline-coach-agent' }),
  Object.freeze({ agentId: 'agt_blog-agent', clientExternalRef: 'agentcore:v1:client:agt_blog-agent', principalExternalRef: 'agentcore:v1:principal:agt_blog-agent' }),
  Object.freeze({ agentId: 'agt_education-agent', clientExternalRef: 'agentcore:v1:client:agt_education-agent', principalExternalRef: 'agentcore:v1:principal:agt_education-agent' }),
  Object.freeze({ agentId: 'agt_psychology-agent', clientExternalRef: 'agentcore:v1:client:agt_psychology-agent', principalExternalRef: 'agentcore:v1:principal:agt_psychology-agent' }),
  Object.freeze({ agentId: 'agt_game-dev-agent', clientExternalRef: 'agentcore:v1:client:agt_game-dev-agent', principalExternalRef: 'agentcore:v1:principal:agt_game-dev-agent' }),
  Object.freeze({ agentId: 'agt_finance-agent', clientExternalRef: 'agentcore:v1:client:agt_finance-agent', principalExternalRef: 'agentcore:v1:principal:agt_finance-agent' }),
  Object.freeze({ agentId: 'agt_devtools-agent', clientExternalRef: 'agentcore:v1:client:agt_devtools-agent', principalExternalRef: 'agentcore:v1:principal:agt_devtools-agent' }),
  Object.freeze({ agentId: 'agt_voice-tech-agent', clientExternalRef: 'agentcore:v1:client:agt_voice-tech-agent', principalExternalRef: 'agentcore:v1:principal:agt_voice-tech-agent' }),
  Object.freeze({ agentId: 'agt_image-gen-agent', clientExternalRef: 'agentcore:v1:client:agt_image-gen-agent', principalExternalRef: 'agentcore:v1:principal:agt_image-gen-agent' }),
  Object.freeze({ agentId: 'agt_email-manager-agent', clientExternalRef: 'agentcore:v1:client:agt_email-manager-agent', principalExternalRef: 'agentcore:v1:principal:agt_email-manager-agent' }),
  Object.freeze({ agentId: 'agt_account-manager-agent', clientExternalRef: 'agentcore:v1:client:agt_account-manager-agent', principalExternalRef: 'agentcore:v1:principal:agt_account-manager-agent' }),
  Object.freeze({ agentId: 'agt_shopping-list-agent', clientExternalRef: 'agentcore:v1:client:agt_shopping-list-agent', principalExternalRef: 'agentcore:v1:principal:agt_shopping-list-agent' }),
  Object.freeze({ agentId: 'agt_feishu-expert-agent', clientExternalRef: 'agentcore:v1:client:agt_feishu-expert-agent', principalExternalRef: 'agentcore:v1:principal:agt_feishu-expert-agent' }),
  Object.freeze({ agentId: 'agt_podcast-producer-agent', clientExternalRef: 'agentcore:v1:client:agt_podcast-producer-agent', principalExternalRef: 'agentcore:v1:principal:agt_podcast-producer-agent' }),
  Object.freeze({ agentId: 'agt_soul-questioner-agent', clientExternalRef: 'agentcore:v1:client:agt_soul-questioner-agent', principalExternalRef: 'agentcore:v1:principal:agt_soul-questioner-agent' }),
  Object.freeze({ agentId: 'agt_lobster-guide-agent', clientExternalRef: 'agentcore:v1:client:agt_lobster-guide-agent', principalExternalRef: 'agentcore:v1:principal:agt_lobster-guide-agent' }),
  Object.freeze({ agentId: 'agt_article-publisher-agent', clientExternalRef: 'agentcore:v1:client:agt_article-publisher-agent', principalExternalRef: 'agentcore:v1:principal:agt_article-publisher-agent' }),
  Object.freeze({ agentId: 'agt_travel-planner-agent', clientExternalRef: 'agentcore:v1:client:agt_travel-planner-agent', principalExternalRef: 'agentcore:v1:principal:agt_travel-planner-agent' }),
  Object.freeze({ agentId: 'agt_agent-dev-engineer', clientExternalRef: 'agentcore:v1:client:agt_agent-dev-engineer', principalExternalRef: 'agentcore:v1:principal:agt_agent-dev-engineer' }),
  Object.freeze({ agentId: 'agt_paper-reviewer-agent', clientExternalRef: 'agentcore:v1:client:agt_paper-reviewer-agent', principalExternalRef: 'agentcore:v1:principal:agt_paper-reviewer-agent' }),
  Object.freeze({ agentId: 'agt_3d-print-agent', clientExternalRef: 'agentcore:v1:client:agt_3d-print-agent', principalExternalRef: 'agentcore:v1:principal:agt_3d-print-agent' }),
  Object.freeze({ agentId: 'agt_writing-style-analyst-agent', clientExternalRef: 'agentcore:v1:client:agt_writing-style-analyst-agent', principalExternalRef: 'agentcore:v1:principal:agt_writing-style-analyst-agent' }),
  Object.freeze({ agentId: 'agt_family-doctor-2-agent', clientExternalRef: 'agentcore:v1:client:agt_family-doctor-2-agent', principalExternalRef: 'agentcore:v1:principal:agt_family-doctor-2-agent' }),
  Object.freeze({ agentId: 'agt_feishu-expert-2-agent', clientExternalRef: 'agentcore:v1:client:agt_feishu-expert-2-agent', principalExternalRef: 'agentcore:v1:principal:agt_feishu-expert-2-agent' }),
  Object.freeze({ agentId: 'agt_reimbursement-expert', clientExternalRef: 'agentcore:v1:client:agt_reimbursement-expert', principalExternalRef: 'agentcore:v1:principal:agt_reimbursement-expert' }),
  Object.freeze({ agentId: 'agt_mobile-app-engineer', clientExternalRef: 'agentcore:v1:client:agt_mobile-app-engineer', principalExternalRef: 'agentcore:v1:principal:agt_mobile-app-engineer' }),
  Object.freeze({ agentId: 'agt_miniapp-game-engineer', clientExternalRef: 'agentcore:v1:client:agt_miniapp-game-engineer', principalExternalRef: 'agentcore:v1:principal:agt_miniapp-game-engineer' }),
  Object.freeze({ agentId: 'agt_trend-tracker', clientExternalRef: 'agentcore:v1:client:agt_trend-tracker', principalExternalRef: 'agentcore:v1:principal:agt_trend-tracker' }),
  Object.freeze({ agentId: 'agt_biz-explorer', clientExternalRef: 'agentcore:v1:client:agt_biz-explorer', principalExternalRef: 'agentcore:v1:principal:agt_biz-explorer' }),
  Object.freeze({ agentId: 'agt_video-producer', clientExternalRef: 'agentcore:v1:client:agt_video-producer', principalExternalRef: 'agentcore:v1:principal:agt_video-producer' }),
  Object.freeze({ agentId: 'agt_creative-writer', clientExternalRef: 'agentcore:v1:client:agt_creative-writer', principalExternalRef: 'agentcore:v1:principal:agt_creative-writer' }),
  Object.freeze({ agentId: 'agt_test-engineer', clientExternalRef: 'agentcore:v1:client:agt_test-engineer', principalExternalRef: 'agentcore:v1:principal:agt_test-engineer' }),
  Object.freeze({ agentId: 'agt_learning-expert', clientExternalRef: 'agentcore:v1:client:agt_learning-expert', principalExternalRef: 'agentcore:v1:principal:agt_learning-expert' }),
  Object.freeze({ agentId: 'agt_content-ops-agent', clientExternalRef: 'agentcore:v1:client:agt_content-ops-agent', principalExternalRef: 'agentcore:v1:principal:agt_content-ops-agent' }),
  Object.freeze({ agentId: 'agt_finance-housekeeper-agent', clientExternalRef: 'agentcore:v1:client:agt_finance-housekeeper-agent', principalExternalRef: 'agentcore:v1:principal:agt_finance-housekeeper-agent' }),
  Object.freeze({ agentId: 'agt_quant-trading-agent', clientExternalRef: 'agentcore:v1:client:agt_quant-trading-agent', principalExternalRef: 'agentcore:v1:principal:agt_quant-trading-agent' }),
  Object.freeze({ agentId: 'agt_novel-writer', clientExternalRef: 'agentcore:v1:client:agt_novel-writer', principalExternalRef: 'agentcore:v1:principal:agt_novel-writer' }),
  Object.freeze({ agentId: 'agt_frontend-react-engineer', clientExternalRef: 'agentcore:v1:client:agt_frontend-react-engineer', principalExternalRef: 'agentcore:v1:principal:agt_frontend-react-engineer' }),
  Object.freeze({ agentId: 'agt_open-source-agent', clientExternalRef: 'agentcore:v1:client:agt_open-source-agent', principalExternalRef: 'agentcore:v1:principal:agt_open-source-agent' }),
  Object.freeze({ agentId: 'agt_smart-home-agent', clientExternalRef: 'agentcore:v1:client:agt_smart-home-agent', principalExternalRef: 'agentcore:v1:principal:agt_smart-home-agent' }),
  Object.freeze({ agentId: 'agt_product-manager', clientExternalRef: 'agentcore:v1:client:agt_product-manager', principalExternalRef: 'agentcore:v1:principal:agt_product-manager' }),
  Object.freeze({ agentId: 'agt_product-designer', clientExternalRef: 'agentcore:v1:client:agt_product-designer', principalExternalRef: 'agentcore:v1:principal:agt_product-designer' }),
  Object.freeze({ agentId: 'agt_qa-reviewer', clientExternalRef: 'agentcore:v1:client:agt_qa-reviewer', principalExternalRef: 'agentcore:v1:principal:agt_qa-reviewer' }),
  Object.freeze({ agentId: 'agt_investment-debater', clientExternalRef: 'agentcore:v1:client:agt_investment-debater', principalExternalRef: 'agentcore:v1:principal:agt_investment-debater' }),
  Object.freeze({ agentId: 'agt_backend-engineer-2', clientExternalRef: 'agentcore:v1:client:agt_backend-engineer-2', principalExternalRef: 'agentcore:v1:principal:agt_backend-engineer-2' }),
  Object.freeze({ agentId: 'agt_qa-reviewer-2', clientExternalRef: 'agentcore:v1:client:agt_qa-reviewer-2', principalExternalRef: 'agentcore:v1:principal:agt_qa-reviewer-2' }),
  Object.freeze({ agentId: 'agt_social-butterfly-agent', clientExternalRef: 'agentcore:v1:client:agt_social-butterfly-agent', principalExternalRef: 'agentcore:v1:principal:agt_social-butterfly-agent' }),
  Object.freeze({ agentId: 'agt_arch-reviewer', clientExternalRef: 'agentcore:v1:client:agt_arch-reviewer', principalExternalRef: 'agentcore:v1:principal:agt_arch-reviewer' }),
  Object.freeze({ agentId: 'agt_explorer', clientExternalRef: 'agentcore:v1:client:agt_explorer', principalExternalRef: 'agentcore:v1:principal:agt_explorer' }),
  Object.freeze({ agentId: 'agt_ppt-designer', clientExternalRef: 'agentcore:v1:client:agt_ppt-designer', principalExternalRef: 'agentcore:v1:principal:agt_ppt-designer' }),
  Object.freeze({ agentId: 'agt_training-expert-agent', clientExternalRef: 'agentcore:v1:client:agt_training-expert-agent', principalExternalRef: 'agentcore:v1:principal:agt_training-expert-agent' }),
  Object.freeze({ agentId: 'agt_needs-radar-agent', clientExternalRef: 'agentcore:v1:client:agt_needs-radar-agent', principalExternalRef: 'agentcore:v1:principal:agt_needs-radar-agent' }),
  Object.freeze({ agentId: 'agt_delivery-review-agent', clientExternalRef: 'agentcore:v1:client:agt_delivery-review-agent', principalExternalRef: 'agentcore:v1:principal:agt_delivery-review-agent' }),
  Object.freeze({ agentId: 'agt_course-community-agent', clientExternalRef: 'agentcore:v1:client:agt_course-community-agent', principalExternalRef: 'agentcore:v1:principal:agt_course-community-agent' }),
  Object.freeze({ agentId: 'agt_biz-product-designer', clientExternalRef: 'agentcore:v1:client:agt_biz-product-designer', principalExternalRef: 'agentcore:v1:principal:agt_biz-product-designer' }),
  Object.freeze({ agentId: 'agt_private-chef-agent', clientExternalRef: 'agentcore:v1:client:agt_private-chef-agent', principalExternalRef: 'agentcore:v1:principal:agt_private-chef-agent' }),
  Object.freeze({ agentId: 'agt_course-community-agent-2', clientExternalRef: 'agentcore:v1:client:agt_course-community-agent-2', principalExternalRef: 'agentcore:v1:principal:agt_course-community-agent-2' }),
  Object.freeze({ agentId: 'agt_book-deconstructor-agent', clientExternalRef: 'agentcore:v1:client:agt_book-deconstructor-agent', principalExternalRef: 'agentcore:v1:principal:agt_book-deconstructor-agent' }),
  Object.freeze({ agentId: 'agt_build-in-public-agent', clientExternalRef: 'agentcore:v1:client:agt_build-in-public-agent', principalExternalRef: 'agentcore:v1:principal:agt_build-in-public-agent' }),
  Object.freeze({ agentId: 'agt_job-watch-agent', clientExternalRef: 'agentcore:v1:client:agt_job-watch-agent', principalExternalRef: 'agentcore:v1:principal:agt_job-watch-agent' }),
  Object.freeze({ agentId: 'agt_search-expert-agent', clientExternalRef: 'agentcore:v1:client:agt_search-expert-agent', principalExternalRef: 'agentcore:v1:principal:agt_search-expert-agent' }),
  Object.freeze({ agentId: 'agt_transcript-editor-agent', clientExternalRef: 'agentcore:v1:client:agt_transcript-editor-agent', principalExternalRef: 'agentcore:v1:principal:agt_transcript-editor-agent' }),
  Object.freeze({ agentId: 'agt_home-repair-agent', clientExternalRef: 'agentcore:v1:client:agt_home-repair-agent', principalExternalRef: 'agentcore:v1:principal:agt_home-repair-agent' }),
  Object.freeze({ agentId: 'agt_sales-copy-agent', clientExternalRef: 'agentcore:v1:client:agt_sales-copy-agent', principalExternalRef: 'agentcore:v1:principal:agt_sales-copy-agent' }),
  Object.freeze({ agentId: 'agt_hao-yang-mao-agent', clientExternalRef: 'agentcore:v1:client:agt_hao-yang-mao-agent', principalExternalRef: 'agentcore:v1:principal:agt_hao-yang-mao-agent' }),
  Object.freeze({ agentId: 'agt_family-steward-agent', clientExternalRef: 'agentcore:v1:client:agt_family-steward-agent', principalExternalRef: 'agentcore:v1:principal:agt_family-steward-agent' }),
  Object.freeze({ agentId: 'agt_video-model-expert', clientExternalRef: 'agentcore:v1:client:agt_video-model-expert', principalExternalRef: 'agentcore:v1:principal:agt_video-model-expert' }),
  Object.freeze({ agentId: 'agt_game-designer-agent', clientExternalRef: 'agentcore:v1:client:agt_game-designer-agent', principalExternalRef: 'agentcore:v1:principal:agt_game-designer-agent' }),
  Object.freeze({ agentId: 'agt_game-producer-agent', clientExternalRef: 'agentcore:v1:client:agt_game-producer-agent', principalExternalRef: 'agentcore:v1:principal:agt_game-producer-agent' }),
  Object.freeze({ agentId: 'agt_reader-simulator-agent', clientExternalRef: 'agentcore:v1:client:agt_reader-simulator-agent', principalExternalRef: 'agentcore:v1:principal:agt_reader-simulator-agent' }),
  Object.freeze({ agentId: 'agt_thesis-advisor-agent', clientExternalRef: 'agentcore:v1:client:agt_thesis-advisor-agent', principalExternalRef: 'agentcore:v1:principal:agt_thesis-advisor-agent' }),
  Object.freeze({ agentId: 'agt_biz-reviewer', clientExternalRef: 'agentcore:v1:client:agt_biz-reviewer', principalExternalRef: 'agentcore:v1:principal:agt_biz-reviewer' }),
  Object.freeze({ agentId: 'agt_translator-agent', clientExternalRef: 'agentcore:v1:client:agt_translator-agent', principalExternalRef: 'agentcore:v1:principal:agt_translator-agent' }),
  Object.freeze({ agentId: 'agt_translation-qa-agent', clientExternalRef: 'agentcore:v1:client:agt_translation-qa-agent', principalExternalRef: 'agentcore:v1:principal:agt_translation-qa-agent' }),
]);

const CANARY_AGENT = 'agt_build-in-public-agent';
const SPEC_FILE = 'docs/specs/AUTH_SERVICE_AGENTCORE_TRUSTED_FLEET_GRANT_SUPPLY_V1.md';
const MIGRATION_ID = 'agentcore-trusted-fleet-grant-supply-v1';
const CLIENT_MAPPING_PATH = '/usr/local/libexec/agent-core/config/.fleet-phase-a-bootstrap/client-mapping.json';
const CLIENT_MAPPING_SHA256 = '60f3f9090fdb941b36fa10bdfea38e5a185562e5d459ee27f7a98f347e7e67b6';
const GRANT_PLAN_SHA256 = '7b36807de526b521262e507f26c7fbedb49e3883e04a60d5bed3f2999c634056';
const PLAN_VERSION = 'AUTH_SERVICE_AGENTCORE_TRUSTED_FLEET_GRANT_SUPPLY_V1_PLAN_1';
const FLEET_TARGET_SCOPES = Object.freeze({
  'svc-workflow': Object.freeze(['workflow.read']),
  'svc-forum': Object.freeze(['forum.read', 'forum.write']),
} as const);
const NON_TARGET_CANARIES = Object.freeze([
  Object.freeze({
    agentId: 'agt_stock_agent',
    clientExternalRef: 'agentcore:v1:client:agt_stock_agent',
    endState: Object.freeze([
      Object.freeze({ audienceId: 'svc-workflow', scopes: Object.freeze(['workflow.read']), version: 1 }),
      Object.freeze({ audienceId: 'svc-forum', scopes: Object.freeze(['forum.read', 'forum.write']), version: 2 }),
    ]),
  }),
  Object.freeze({
    agentId: 'agt_cto-agent',
    clientExternalRef: 'agentcore:v1:client:agt_cto-agent',
    endState: Object.freeze([
      Object.freeze({ audienceId: 'svc-workflow', scopes: Object.freeze(['workflow.read']), version: 1 }),
      Object.freeze({ audienceId: 'svc-forum', scopes: Object.freeze(['forum.read', 'forum.write']), version: 2 }),
    ]),
  }),
] as const);
const AUDIT_KEYS = Object.freeze([
  'change_id', 'migration_id', 'source_git_commit', 'operator_id', 'approval_ref',
  'reason', 'client_id', 'change_type', 'expected_grant_version',
  'resulting_grant_version', 'before_value', 'after_value', 'timestamp',
]);
const IMAGE = 'postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777';
const DATABASE = 'auth_tfs_conformance';
const CONFORMANCE_LABEL = 'com.mayf3.auth.tfs-conformance';

function fail(message: string): never {
  throw new Error(`Trusted fleet supply refused: ${message}`);
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown, label: string, maxBytes: number): string {
  if (typeof value !== 'string' || value.length === 0 || Buffer.byteLength(value, 'utf8') > maxBytes) {
    fail(`${label} must be non-empty and at most ${maxBytes} UTF-8 bytes`);
  }
  return value;
}
function exactText(value: unknown, expected: string, label: string): string {
  if (value !== expected) fail(`${label} must equal ${expected}`);
  return expected;
}
function lowercaseHex(value: unknown, length: number, label: string): string {
  if (typeof value !== 'string' || !new RegExp(`^[0-9a-f]{${length}}$`).test(value)) {
    fail(`${label} must be lowercase ${length}-hex`);
  }
  return value;
}
function asciiCompare(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, 'ascii'), Buffer.from(b, 'ascii'));
}
function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (isObject(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  }
  return value;
}
function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonicalJson(a)) === JSON.stringify(canonicalJson(b));
}

// JSON.parse accepts duplicate members. This scanner rejects decoded duplicate keys at every depth.
function parseUniqueJson(bytes: Buffer | string, label: string, maxBytes: number): Json {
  const source = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8');
  if (source.length === 0 || source.length > maxBytes) fail(`${label} byte length is invalid`);
  const input = source.toString('utf8');
  if (!Buffer.from(input, 'utf8').equals(source)) fail(`${label} is not UTF-8`);
  let index = 0;
  const whitespace = () => {
    while (index < input.length && [0x20, 0x09, 0x0a, 0x0d].includes(input.charCodeAt(index))) index += 1;
  };
  const stringToken = (): string => {
    if (input[index] !== '"') fail(`${label} contains invalid JSON`);
    const start = index;
    let containsEscape = false;
    index += 1;
    while (index < input.length) {
      const char = input[index++];
      if (char === '"') {
        if (!containsEscape) return input.slice(start + 1, index - 1);
        try { return JSON.parse(input.slice(start, index)) as string; } catch { fail(`${label} contains invalid string`); }
      }
      if (char === '\\') { containsEscape = true; index += 1; }
      else if (char !== undefined && char.charCodeAt(0) < 0x20) fail(`${label} contains invalid string`);
    }
    fail(`${label} contains unterminated string`);
  };
  const value = (): void => {
    whitespace();
    const char = input[index];
    if (char === '{') {
      index += 1; whitespace();
      const keys = new Set<string>();
      if (input[index] === '}') { index += 1; return; }
      while (true) {
        whitespace(); const key = stringToken();
        if (keys.has(key)) fail(`${label} contains duplicate member ${key}`);
        keys.add(key); whitespace();
        if (input[index++] !== ':') fail(`${label} contains invalid object`);
        value(); whitespace();
        const separator = input[index++];
        if (separator === '}') return;
        if (separator !== ',') fail(`${label} contains invalid object`);
      }
    }
    if (char === '[') {
      index += 1; whitespace();
      if (input[index] === ']') { index += 1; return; }
      while (true) {
        value(); whitespace();
        const separator = input[index++];
        if (separator === ']') return;
        if (separator !== ',') fail(`${label} contains invalid array`);
      }
    }
    if (char === '"') { stringToken(); return; }
    const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/u.exec(input.slice(index));
    if (!match) fail(`${label} contains invalid JSON value`);
    index += match[0].length;
  };
  value(); whitespace();
  if (index !== input.length) fail(`${label} contains trailing bytes`);
  try { return JSON.parse(input) as Json; } catch { fail(`${label} is invalid JSON`); }
}

function sha256Hex(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function completeSnapshot(client: {
  clientId: string;
  machinePrincipalId: string;
  status: string;
  principal: { principalType: string };
}, grants: GrantRow[], revision: number): Prisma.InputJsonObject {
  const machineAccessGrants: Record<string, Prisma.InputJsonValue> = {};
  for (const grant of [...grants].sort((a, b) => asciiCompare(a.audienceId, b.audienceId))) {
    machineAccessGrants[grant.audienceId] = [...grant.scopes].sort(asciiCompare);
  }
  return {
    client_id: client.clientId,
    client_kind: 'machine',
    principal_id: client.machinePrincipalId,
    principal_type: client.principal.principalType,
    human_audience_grants: [],
    machine_access_grants: machineAccessGrants,
    delegation_grants: {},
    status: client.status,
    version: revision,
  };
}

function validateMetadata(metadata: Metadata): void {
  text(metadata.migrationId, 'migration_id', 128);
  lowercaseHex(metadata.sourceGitCommit, 40, 'source_git_commit');
  text(metadata.operatorId, 'operator_id', 256);
  text(metadata.approvalRef, 'approval_ref', 2048);
  text(metadata.reason, 'reason', 512);
}

function verifyMapping(bytes: Buffer, expectedSha256: string, expectedAgents: readonly string[]): Mapping {
  if (sha256Hex(bytes) !== expectedSha256) fail('client mapping digest does not equal the frozen value');
  const parsed = parseUniqueJson(bytes, 'client mapping', 256 * 1024);
  if (!isObject(parsed)) fail('client mapping must be an object');
  const agents = Object.keys(parsed);
  if (agents.length !== 86) fail('client mapping must hold exactly 86 entries');
  if (new Set(agents).size !== 86) fail('client mapping agents are not unique');
  const expected = [...expectedAgents].sort(asciiCompare);
  if (JSON.stringify(agents.sort(asciiCompare)) !== JSON.stringify(expected)) {
    fail('client mapping agents do not equal the exact 86 roster');
  }
  const mapping: Record<string, string> = {};
  const clientIds = new Set<string>();
  for (const [agentId, value] of Object.entries(parsed)) {
    if (typeof value !== 'string' || !/^mc_[A-Za-z0-9_-]{24}$/.test(value)) {
      fail(`client mapping entry for ${agentId} is not a valid public client ID`);
    }
    if (/secret|credential|token/i.test(agentId)) fail('client mapping contains a secret-bearing key');
    if (clientIds.has(value)) fail('client mapping client IDs are not unique');
    clientIds.add(value);
    mapping[agentId] = value;
  }
  return mapping;
}

function targetEndStateGrants(): GrantRow[] {
  return Object.entries(FLEET_TARGET_SCOPES).map(([audienceId, scopes]) => ({
    audienceId, scopes: [...scopes], version: 1,
  }));
}

async function validateAudiences(db: Db): Promise<void> {
  for (const [audienceId, scopes] of Object.entries(FLEET_TARGET_SCOPES)) {
    const rows = await db.authAudience.findMany({
      where: { audienceId },
      select: {
        audienceId: true, status: true, machineAccessEnabled: true,
        acceptedPrincipalTypes: true, registeredScopes: true,
      },
    });
    if (rows.length !== 1) fail(`${audienceId} must resolve exactly once`);
    const audience = rows[0];
    if (audience.status !== 'active' || !audience.machineAccessEnabled
        || !audience.acceptedPrincipalTypes.includes('agent')
        || !scopes.every((scope) => audience.registeredScopes.includes(scope))) {
      fail(`${audienceId} is inactive, not machine/agent enabled, or does not register its target scopes`);
    }
  }
}

async function loadClientState(db: Db, target: Target, mapping: Mapping | null): Promise<ClientState> {
  const principals = await db.machinePrincipal.findMany({
    where: { OR: [{ externalRef: target.principalExternalRef }, { agentId: target.agentId }] },
    select: { id: true, externalRef: true, agentId: true, principalType: true, status: true },
  });
  if (principals.length !== 1 || principals[0].externalRef !== target.principalExternalRef
      || principals[0].agentId !== target.agentId || principals[0].principalType !== 'agent'
      || principals[0].status !== 'active') fail(`${target.agentId} principal must resolve uniquely and exactly`);
  const rows = await db.machineClient.findMany({
    where: { externalRef: target.clientExternalRef },
    select: {
      id: true, clientId: true, externalRef: true, machinePrincipalId: true, status: true,
      principal: {
        select: { id: true, externalRef: true, agentId: true, principalType: true, status: true },
      },
      accessGrants: {
        select: { audienceId: true, scopes: true, version: true },
        orderBy: { audienceId: 'asc' },
      },
      trustedProxy: { select: { delegationGrants: { select: { audienceId: true } } } },
    },
  });
  if (rows.length !== 1) fail(`${target.clientExternalRef} must resolve exactly once`);
  const client = rows[0];
  if (client.externalRef !== target.clientExternalRef || client.status !== 'active'
      || client.principal.id !== client.machinePrincipalId || client.principal.id !== principals[0].id
      || client.principal.externalRef !== target.principalExternalRef
      || client.principal.agentId !== target.agentId
      || client.principal.principalType !== 'agent' || client.principal.status !== 'active') {
    fail(`${target.agentId} identity binding is invalid`);
  }
  if (!/^mc_[A-Za-z0-9_-]{24}$/.test(client.clientId)) fail(`${target.agentId} public client ID is invalid`);
  if (mapping !== null && mapping[target.agentId] !== client.clientId) {
    fail(`${target.agentId} live client ID does not equal the trusted mapping entry`);
  }
  if (client.trustedProxy !== null && client.trustedProxy.delegationGrants.length !== 0) {
    fail(`${target.agentId} has delegation grants outside the fleet target snapshot`);
  }

  const audits = await db.grantChangeAudit.findMany({
    where: { clientId: client.clientId },
    select: {
      id: true, migrationId: true, clientId: true, changeType: true, expectedGrantVersion: true,
      resultingGrantVersion: true, beforeValue: true, afterValue: true, timestamp: true,
    },
    orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
  });
  if (client.accessGrants.length === 0 && audits.length === 0) {
    const afterValue = completeSnapshot(client, targetEndStateGrants(), 1);
    return { target, internalClientId: client.id, publicClientId: client.clientId,
      principalId: client.machinePrincipalId, outcome: 'create', afterValue };
  }
  const endState = targetEndStateGrants().sort((a, b) => asciiCompare(a.audienceId, b.audienceId));
  const exactGrants = client.accessGrants.length === endState.length
    && client.accessGrants.every((grant, index) => grant.audienceId === endState[index].audienceId
      && grant.version === 1 && sameJson([...grant.scopes].sort(asciiCompare), [...endState[index].scopes].sort(asciiCompare)));
  const afterValue = completeSnapshot(client, client.accessGrants, 1);
  const exactAudit = audits.length === 1
    && audits[0].migrationId === MIGRATION_ID
    && audits[0].changeType === 'create'
    && audits[0].expectedGrantVersion === null
    && audits[0].resultingGrantVersion === 1
    && audits[0].clientId === client.clientId
    && audits[0].beforeValue === null
    && sameJson(audits[0].afterValue, afterValue);
  if (!exactGrants || !exactAudit) {
    fail(`${target.agentId} existing grant/audit state conflicts with the fleet target end-state`);
  }
  return { target, internalClientId: client.id, publicClientId: client.clientId,
    principalId: client.machinePrincipalId, outcome: 'noop', afterValue };
}

async function loadNonTarget(db: Db): Promise<FleetState['nonTarget']> {
  const observed: FleetState['nonTarget'] = [];
  for (const canary of NON_TARGET_CANARIES) {
    const rows = await db.machineClient.findMany({
      where: { externalRef: canary.clientExternalRef },
      select: {
        clientId: true, status: true,
        accessGrants: { select: { audienceId: true, scopes: true, version: true }, orderBy: { audienceId: 'asc' } },
      },
    });
    if (rows.length !== 1 || rows[0].status !== 'active') {
      fail(`non-target canary ${canary.agentId} must resolve exactly once and stay active`);
    }
    const grants = rows[0].accessGrants;
    const expected = [...canary.endState];
    const preserved = grants.length === expected.length && grants.every((grant, index) => {
      const match = expected.find((item) => item.audienceId === grant.audienceId);
      return match !== undefined && match.version === grant.version
        && sameJson([...grant.scopes].sort(asciiCompare), [...match.scopes].sort(asciiCompare));
    });
    if (!preserved) fail(`non-target canary ${canary.agentId} is not at its Stage W/F end-state`);
    observed.push({ agentId: canary.agentId, grants });
  }
  return observed;
}

async function loadFleetState(db: Db, mapping: Mapping | null): Promise<FleetState> {
  await validateAudiences(db);
  const clients: ClientState[] = [];
  for (const target of [...TARGETS].sort((a, b) => asciiCompare(a.agentId, b.agentId))) {
    clients.push(await loadClientState(db, target, mapping));
  }
  const nonTarget = await loadNonTarget(db);
  return { clients, nonTarget };
}

function planDocument(state: FleetState): unknown {
  const rows = state.clients.map((client) => ({
    agent_id: client.target.agentId,
    client_id: client.publicClientId,
    audiences: {
      'svc-workflow': {
        current_state: client.outcome === 'noop' ? 'EXACT_MATCH' : 'ABSENT',
        operation: client.outcome === 'noop' ? 'NOOP' : 'CREATE',
        target_scopes: [...FLEET_TARGET_SCOPES['svc-workflow']],
      },
      'svc-forum': {
        current_state: client.outcome === 'noop' ? 'EXACT_MATCH' : 'ABSENT',
        operation: client.outcome === 'noop' ? 'NOOP' : 'CREATE',
        target_scopes: [...FLEET_TARGET_SCOPES['svc-forum']],
      },
    },
  }));
  return {
    plan_version: PLAN_VERSION,
    client_mapping_sha256: CLIENT_MAPPING_SHA256,
    targets: {
      'svc-workflow': [...FLEET_TARGET_SCOPES['svc-workflow']],
      'svc-forum': [...FLEET_TARGET_SCOPES['svc-forum']],
    },
    rows,
  };
}

function digestGate(state: FleetState, expectedSha256: string, label: string): { create: number; noop: number } {
  const create = state.clients.filter((client) => client.outcome === 'create').length;
  const noop = state.clients.length - create;
  if (create === state.clients.length) {
    const digest = sha256Hex(Buffer.from(JSON.stringify(canonicalJson(planDocument(state))), 'utf8'));
    if (digest !== expectedSha256) fail(`${label} digest does not equal the frozen fleet grant plan`);
    return { create, noop };
  }
  if (create + noop !== state.clients.length) fail('fleet state holds an unclassifiable client');
  return { create, noop };
}

function auditEnvelope(metadata: Metadata, client: ClientState, id: string, timestamp: Date): Record<string, unknown> {
  const envelope = {
    change_id: id,
    migration_id: metadata.migrationId,
    source_git_commit: metadata.sourceGitCommit,
    operator_id: metadata.operatorId,
    approval_ref: metadata.approvalRef,
    reason: metadata.reason,
    client_id: client.publicClientId,
    change_type: 'create',
    expected_grant_version: null,
    resulting_grant_version: 1,
    before_value: null,
    after_value: client.afterValue,
    timestamp: timestamp.toISOString(),
  };
  const keys: readonly string[] = AUDIT_KEYS;
  const actual = Object.keys(envelope).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail('grant audit has a missing or additional field');
  }
  return envelope;
}

async function applyClient(prisma: PrismaClient, metadata: Metadata, target: Target, mapping: Mapping | null): Promise<'create' | 'noop'> {
  validateMetadata(metadata);
  return prisma.$transaction(async (tx) => {
    // Table locks make non-cooperating Grant/audit writers serialize before or after this client.
    // A writer that commits first is visible to the reloaded state and becomes a conflict.
    await tx.$executeRawUnsafe('LOCK TABLE machine_access_grants IN SHARE ROW EXCLUSIVE MODE');
    await tx.$executeRawUnsafe('LOCK TABLE grant_change_audits IN SHARE ROW EXCLUSIVE MODE');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(814_652_013)`;
    const client = await loadClientState(tx, target, mapping);
    if (client.outcome === 'noop') return 'noop';
    for (const [audienceId, scopes] of Object.entries(FLEET_TARGET_SCOPES)) {
      await tx.machineAccessGrant.create({ data: {
        machineClientId: client.internalClientId,
        audienceId,
        scopes: [...scopes],
        version: 1,
      } });
    }
    const id = randomUUID();
    const timestamp = new Date();
    const envelope = auditEnvelope(metadata, client, id, timestamp);
    await tx.grantChangeAudit.create({ data: {
      id,
      migrationId: envelope.migration_id as string,
      sourceGitCommit: envelope.source_git_commit as string,
      operatorId: envelope.operator_id as string,
      approvalRef: envelope.approval_ref as string,
      reason: envelope.reason as string,
      clientId: envelope.client_id as string,
      changeType: 'create',
      expectedGrantVersion: null,
      resultingGrantVersion: 1,
      beforeValue: Prisma.DbNull,
      afterValue: client.afterValue,
      timestamp,
    } });
    const reselected = await tx.machineAccessGrant.findMany({
      where: { machineClientId: client.internalClientId },
      select: { audienceId: true, scopes: true, version: true },
      orderBy: { audienceId: 'asc' },
    });
    const endState = targetEndStateGrants().sort((a, b) => asciiCompare(a.audienceId, b.audienceId));
    const verified = reselected.length === endState.length
      && reselected.every((grant, index) => grant.audienceId === endState[index].audienceId
        && grant.version === 1 && sameJson([...grant.scopes].sort(asciiCompare), [...endState[index].scopes].sort(asciiCompare)));
    if (!verified) fail(`${target.agentId} complete end-state re-select verification failed before commit`);
    return 'create';
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function runScope(prisma: PrismaClient, metadata: Metadata | null, scope: 'canary' | 'fleet', mapping: Mapping | null, expectedPlanSha256: string): Promise<void> {
  const state = await loadFleetState(prisma, mapping);
  const counts = digestGate(state, expectedPlanSha256, 'grant plan');
  const before = JSON.stringify(canonicalJson(state.nonTarget));
  const canary = state.clients.find((client) => client.target.agentId === CANARY_AGENT);
  if (canary === undefined) fail('fleet canary is absent from the exact roster');
  let processed: ClientState[];
  if (scope === 'canary') {
    processed = [canary];
  } else {
    // The Build-in-Public-first gate binds mutation only; read-only plans observe the fleet at any stage.
    if (metadata !== null && canary.outcome !== 'noop') {
      fail('fleet gate: Build-in-Public canary has not reached its audited end-state');
    }
    processed = state.clients.filter((client) => client.target.agentId !== CANARY_AGENT);
  }
  const outcomes: Array<{ agent_id: string; client_id: string; outcome: string }> = [];
  if (metadata === null) {
    for (const client of processed) {
      outcomes.push({ agent_id: client.target.agentId, client_id: client.publicClientId, outcome: client.outcome });
    }
  } else {
    for (const client of processed) {
      const outcome = await applyClient(prisma, metadata, client.target, mapping);
      outcomes.push({ agent_id: client.target.agentId, client_id: client.publicClientId, outcome });
    }
    const after = await loadFleetState(prisma, mapping);
    if (JSON.stringify(canonicalJson(after.nonTarget)) !== before) {
      fail('non-target canary grants drifted during apply');
    }
  }
  const created = outcomes.filter((item) => item.outcome === 'create').length;
  process.stdout.write(`${JSON.stringify({
    stage: 'TFS', operation: metadata === null ? 'plan' : 'apply', scope,
    processed: outcomes.length, created, noop: outcomes.length - created,
    grants_created: metadata === null ? 0 : created * 2,
    audits_created: metadata === null ? 0 : created,
    fleet_counts: counts,
    non_target_canaries: 'preserved',
    outcomes,
  })}\n`);
}

function cleanHead(): string {
  const git = '/usr/bin/git';
  const status = execFileSync(git, ['-C', REPO_ROOT, 'status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' });
  if (status.length !== 0) fail('auth-service executable worktree is dirty');
  const top = execFileSync(git, ['-C', REPO_ROOT, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  if (`${top}/` !== REPO_ROOT) fail('executable repository root mismatch');
  return execFileSync(git, ['-C', REPO_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function requireAcceptedSpec(): void {
  const spec = readFileSync(`${REPO_ROOT}${SPEC_FILE}`, 'utf8');
  if (!spec.includes('spec_id: AUTH_SERVICE_AGENTCORE_TRUSTED_FLEET_GRANT_SUPPLY_V1')
      || !spec.includes('status: accepted')
      || !spec.includes('implementation_authority: contracts')) {
    fail('governing spec is not the accepted trusted fleet grant supply V1 at this HEAD');
  }
}

function readFifo(fdText: string | undefined, label: string, maxBytes = 1024 * 1024): Json {
  if (fdText === undefined || !/^(?:[3-9]|[1-9]\d+)$/.test(fdText)) fail(`${label} descriptor is invalid`);
  const fd = Number(fdText);
  if (!fstatSync(fd).isFIFO()) fail(`${label} descriptor must be a FIFO`);
  const chunks: Buffer[] = []; let size = 0;
  while (true) {
    const chunk = Buffer.allocUnsafe(64 * 1024);
    const count = readSync(fd, chunk, 0, chunk.length, null);
    if (count === 0) break;
    size += count;
    if (size > maxBytes) { closeSync(fd); fail(`${label} exceeds its byte limit`); }
    chunks.push(chunk.subarray(0, count));
  }
  closeSync(fd);
  return parseUniqueJson(Buffer.concat(chunks), label, maxBytes);
}

function minimalDockerEnv(): NodeJS.ProcessEnv { return { PATH: '/usr/local/bin:/usr/bin:/bin' }; }

type ConformanceContext = {
  url: string;
  metadata: Metadata;
  nonce: string;
  serverAddress: string;
  mapping: Mapping;
  planSha256: string;
};

function conformanceUrl(descriptor: Record<string, unknown>): string {
  const keys: readonly string[] = ['schema_version', 'container_id', 'nonce', 'host_port', 'database', 'audit_metadata', 'fixture_mapping', 'mapping_sha256', 'plan_sha256'];
  const actual = Object.keys(descriptor).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail('conformance descriptor has a missing or additional field');
  }
  if (descriptor.schema_version !== 1) fail('descriptor schema version invalid');
  const containerId = lowercaseHex(descriptor.container_id, 64, 'container_id');
  const nonce = lowercaseHex(descriptor.nonce, 64, 'nonce');
  if (!Number.isInteger(descriptor.host_port) || (descriptor.host_port as number) < 1 || (descriptor.host_port as number) > 65535) fail('host_port invalid');
  exactText(descriptor.database, DATABASE, 'database');
  if (!isObject(descriptor.audit_metadata)) fail('audit_metadata invalid');
  const metadataObject = descriptor.audit_metadata;
  const metadataKeys: readonly string[] = ['migration_id', 'source_git_commit', 'operator_id', 'approval_ref', 'reason'];
  const actualMetadata = Object.keys(metadataObject).sort();
  const expectedMetadata = [...metadataKeys].sort();
  if (actualMetadata.length !== expectedMetadata.length || actualMetadata.some((key, index) => key !== expectedMetadata[index])) {
    fail('audit_metadata has a missing or additional field');
  }
  const metadata: Metadata = {
    migrationId: text(metadataObject.migration_id, 'migration_id', 128),
    sourceGitCommit: lowercaseHex(metadataObject.source_git_commit, 40, 'source_git_commit'),
    operatorId: text(metadataObject.operator_id, 'operator_id', 256),
    approvalRef: text(metadataObject.approval_ref, 'approval_ref', 2048),
    reason: text(metadataObject.reason, 'reason', 512),
  };
  validateMetadata(metadata);
  if (!isObject(descriptor.fixture_mapping)) fail('fixture_mapping must be an object');
  const mappingSha256 = lowercaseHex(descriptor.mapping_sha256, 64, 'mapping_sha256');
  const planSha256 = lowercaseHex(descriptor.plan_sha256, 64, 'plan_sha256');
  const inspectRaw = execFileSync('/usr/local/bin/docker', ['inspect', containerId], { encoding: 'utf8', env: minimalDockerEnv() });
  const inspected = parseUniqueJson(inspectRaw, 'docker inspect', 2 * 1024 * 1024);
  if (!Array.isArray(inspected) || inspected.length !== 1 || !isObject(inspected[0])) fail('docker inspect shape invalid');
  const info = inspected[0];
  const config = info.Config; const state = info.State; const hostConfig = info.HostConfig; const network = info.NetworkSettings;
  if (!isObject(config) || !isObject(state) || !isObject(hostConfig) || !isObject(network)) fail('docker inspect sections invalid');
  const ports = network.Ports;
  const networks = network.Networks;
  const labels = config.Labels;
  const mounts = info.Mounts;
  const emptyOrNull = (value: unknown) => value === null || (Array.isArray(value) && value.length === 0);
  if (config.Image !== IMAGE || state.Running !== true || hostConfig.AutoRemove !== true
      || typeof info.Name !== 'string' || !info.Name.startsWith('/auth-tfs-conformance-')
      || !isObject(labels) || labels[CONFORMANCE_LABEL] !== `sha256:${createHash('sha256').update(nonce).digest('hex')}`
      || !isObject(hostConfig.Tmpfs) || !Object.hasOwn(hostConfig.Tmpfs, '/var/lib/postgresql/data')
      || !Array.isArray(mounts) || mounts.length !== 0 || hostConfig.Privileged !== false
      || !emptyOrNull(hostConfig.CapAdd) || !emptyOrNull(hostConfig.CapDrop)
      || !emptyOrNull(hostConfig.Devices) || !emptyOrNull(hostConfig.DeviceCgroupRules)
      || !emptyOrNull(hostConfig.DeviceRequests) || !emptyOrNull(hostConfig.SecurityOpt)
      || !emptyOrNull(hostConfig.Binds) || hostConfig.ReadonlyRootfs !== false
      || hostConfig.PidMode !== '' || hostConfig.IpcMode !== 'private'
      || hostConfig.UTSMode !== '' || hostConfig.UsernsMode !== ''
      || hostConfig.NetworkMode !== 'bridge' || !isObject(networks) || Object.keys(networks).length !== 1
      || !isObject(networks.bridge) || typeof networks.bridge.IPAddress !== 'string' || networks.bridge.IPAddress.length === 0
      || !isObject(ports) || Object.keys(ports).length !== 1 || !Array.isArray(ports['5432/tcp'])
      || ports['5432/tcp'].length !== 1 || !isObject(ports['5432/tcp'][0])
      || ports['5432/tcp'][0].HostIp !== '127.0.0.1'
      || Number(ports['5432/tcp'][0].HostPort) !== descriptor.host_port) fail('container is not exact disposable conformance PostgreSQL');
  const privateBinding = { metadata, serverAddress: `${networks.bridge.IPAddress}/32` };
  return `postgresql://tfs_runner@127.0.0.1:${descriptor.host_port}/${DATABASE}?schema=public&application_name=tfs_${nonce}#${Buffer.from(JSON.stringify(privateBinding)).toString('base64url')}`;
}

function parseConformanceUrl(value: string): ConformanceContext {
  const parsed = new URL(value);
  const binding = JSON.parse(Buffer.from(parsed.hash.slice(1), 'base64url').toString('utf8')) as { metadata: Metadata; serverAddress: string };
  const nonce = parsed.searchParams.get('application_name')?.replace(/^tfs_/, '') ?? '';
  parsed.hash = ''; parsed.searchParams.delete('application_name');
  return { url: parsed.toString(), metadata: binding.metadata, nonce, serverAddress: binding.serverAddress,
    mapping: {} as Mapping, planSha256: '' };
}

function parseArgs(argv: string[]): Record<string, string | true> {
  const result: Record<string, string | true> = {};
  const values = new Set(['--scope', '--metadata-fd', '--descriptor-fd']);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--') || Object.hasOwn(result, arg)) fail(`unknown or duplicate argument ${arg}`);
    if (values.has(arg)) {
      const next = argv[++index];
      if (next === undefined || next.startsWith('--')) fail(`${arg} requires a value`);
      result[arg] = next;
    } else if (['--plan', '--apply', '--conformance-apply'].includes(arg)) result[arg] = true;
    else fail(`unknown argument ${arg}`);
  }
  if (result['--scope'] === undefined) result['--scope'] = 'fleet';
  if (result['--scope'] !== 'canary' && result['--scope'] !== 'fleet') fail('--scope must be canary or fleet');
  return result;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const modes = ['--plan', '--apply', '--conformance-apply'].filter((key) => args[key] === true);
  if (modes.length > 1) fail('execution modes are mutually exclusive');
  const scope = args['--scope'] as 'canary' | 'fleet';
  if (args['--conformance-apply']) {
    if (process.env.DATABASE_URL !== undefined
        || Object.keys(args).some((key) => !['--conformance-apply', '--descriptor-fd', '--scope'].includes(key))) {
      fail('DB conformance accepts only its FIFO descriptor and scope');
    }
    const descriptor = readFifo(args['--descriptor-fd'] as string | undefined, 'conformance');
    if (!isObject(descriptor)) fail('conformance descriptor must be an object');
    const encoded = conformanceUrl(descriptor);
    const context = parseConformanceUrl(encoded);
    const fixtureBytes = Buffer.from(JSON.stringify(descriptor.fixture_mapping), 'utf8');
    context.mapping = verifyMapping(fixtureBytes, lowercaseHex(descriptor.mapping_sha256, 64, 'mapping_sha256'), TARGETS.map((target) => target.agentId));
    context.planSha256 = lowercaseHex(descriptor.plan_sha256, 64, 'plan_sha256');
    const prisma = new PrismaClient({ datasources: { db: { url: context.url } } });
    try {
      const probe = await prisma.$queryRaw<Array<{ database: string; address: string; port: number; nonce: string }>>`
        SELECT current_database() AS database, inet_server_addr()::text AS address,
               inet_server_port() AS port, current_setting('tfs.conformance_nonce') AS nonce`;
      if (probe.length !== 1 || probe[0].database !== DATABASE || probe[0].nonce !== context.nonce || probe[0].port !== 5432
          || probe[0].address !== context.serverAddress) fail('connected server identity is invalid');
      await runScope(prisma, context.metadata, scope, context.mapping, context.planSha256);
    } finally { await prisma.$disconnect(); }
    return;
  }
  if (args['--apply']) {
    if (Object.keys(args).some((key) => !['--apply', '--scope', '--metadata-fd'].includes(key))) {
      fail('apply accepts only scope and its metadata FIFO');
    }
    const head = cleanHead();
    requireAcceptedSpec();
    if (!process.env.DATABASE_URL) fail('DATABASE_URL is required for apply');
    const metadataJson = readFifo(args['--metadata-fd'] as string | undefined, 'audit metadata');
    if (!isObject(metadataJson)) fail('audit metadata must be an object');
    const metadataKeys: readonly string[] = ['migration_id', 'source_git_commit', 'operator_id', 'approval_ref', 'reason'];
    const actual = Object.keys(metadataJson).sort();
    const expected = [...metadataKeys].sort();
    if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
      fail('audit metadata has a missing or additional field');
    }
    const metadata: Metadata = {
      migrationId: text(metadataJson.migration_id, 'migration_id', 128),
      sourceGitCommit: lowercaseHex(metadataJson.source_git_commit, 40, 'source_git_commit'),
      operatorId: text(metadataJson.operator_id, 'operator_id', 256),
      approvalRef: text(metadataJson.approval_ref, 'approval_ref', 2048),
      reason: text(metadataJson.reason, 'reason', 512),
    };
    validateMetadata(metadata);
    if (metadata.migrationId !== MIGRATION_ID || metadata.sourceGitCommit !== head) {
      fail('audit metadata is not bound to this migration and the clean reviewed HEAD');
    }
    const mapping = verifyMapping(readFileSync(CLIENT_MAPPING_PATH), CLIENT_MAPPING_SHA256, TARGETS.map((target) => target.agentId));
    const prisma = new PrismaClient();
    try { await runScope(prisma, metadata, scope, mapping, GRANT_PLAN_SHA256); } finally { await prisma.$disconnect(); }
    return;
  }
  if (Object.keys(args).some((key) => !['--plan', '--scope'].includes(key))) fail('plan accepts only scope');
  if (!process.env.DATABASE_URL) fail('DATABASE_URL is required for read-only plan');
  const prisma = new PrismaClient();
  try { await runScope(prisma, null, scope, null, GRANT_PLAN_SHA256); } finally { await prisma.$disconnect(); }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
