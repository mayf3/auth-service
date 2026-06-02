-- Create service_registrations table for SSO Gateway
CREATE TABLE IF NOT EXISTS "service_registrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "service_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "jwt_audience" TEXT NOT NULL,
    "allowed_roles" TEXT NOT NULL DEFAULT 'admin,developer,agent,requester',
    "service_url" TEXT,
    "api_public_key" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_registrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "service_registrations_service_name_key" ON "service_registrations"("service_name");
CREATE UNIQUE INDEX IF NOT EXISTS "service_registrations_jwt_audience_key" ON "service_registrations"("jwt_audience");

-- Seed existing services
INSERT INTO "service_registrations" ("service_name", "display_name", "jwt_audience", "allowed_roles", "service_url", "description")
VALUES
  ('agent-dev-center', 'ADC 需求平台', 'adc-api', 'admin,developer,agent,requester,cto_agent', 'http://localhost:4000', 'Agent Dev Center 需求管理平台'),
  ('auth-service', 'Auth Service', 'unified-platform', 'admin,developer,agent,requester', 'http://localhost:4001', '统一认证服务'),
  ('llm-wiki', 'LLM Wiki', 'llm-wiki-api', 'admin,developer,agent,requester', 'http://localhost:3458', 'LLM 知识库'),
  ('llm-todo', 'LLM Todo', 'llm-todo-api', 'admin,developer,agent,requester', 'http://localhost:3460', '任务管理系统')
ON CONFLICT ("service_name") DO NOTHING;
