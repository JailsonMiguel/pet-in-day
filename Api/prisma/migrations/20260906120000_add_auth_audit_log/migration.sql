-- CreateEnum
CREATE TYPE "AuthEventType" AS ENUM ('login_success', 'login_failure', 'logout', 'token_refresh', 'token_refresh_failure', 'register');

-- CreateTable
CREATE TABLE "auth_audit_logs" (
    "id" UUID NOT NULL,
    "event_type" "AuthEventType" NOT NULL,
    "success" BOOLEAN NOT NULL,
    "user_id" UUID,
    "email" VARCHAR(255),
    "ip_address" INET,
    "user_agent" TEXT,
    "reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_auth_audit_user_id" ON "auth_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "idx_auth_audit_email" ON "auth_audit_logs"("email");

-- CreateIndex
CREATE INDEX "idx_auth_audit_created_at" ON "auth_audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "auth_audit_logs" ADD CONSTRAINT "auth_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

