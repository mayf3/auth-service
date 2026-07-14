-- CreateEnum
CREATE TYPE "PrincipalType" AS ENUM ('agent');

-- CreateEnum
CREATE TYPE "PrincipalStatus" AS ENUM ('active', 'disabled');

-- CreateEnum 
CREATE TYPE "ClientStatus" AS ENUM ('active', 'revoked');

-- CreateTable
CREATE TABLE "machine_principals" (
    "id" UUID NOT NULL,
    "principal_type" "PrincipalType" NOT NULL DEFAULT 'agent',
    "agent_id" TEXT NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "display_name" TEXT,
    "status" "PrincipalStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "disabled_at" TIMESTAMP(3),

    CONSTRAINT "machine_principals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_clients" (
    "id" UUID NOT NULL,
    "client_id" TEXT NOT NULL,
    "machine_principal_id" UUID NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "status" "ClientStatus" NOT NULL DEFAULT 'active',
    "allowed_resources" TEXT[],
    "allowed_scopes" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "rotated_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "machine_clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "machine_principals_agent_id_key" ON "machine_principals"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "machine_clients_client_id_key" ON "machine_clients"("client_id");

-- AddForeignKey
ALTER TABLE "machine_principals" ADD CONSTRAINT "machine_principals_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_clients" ADD CONSTRAINT "machine_clients_machine_principal_id_fkey" FOREIGN KEY ("machine_principal_id") REFERENCES "machine_principals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
