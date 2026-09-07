-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('platform_admin', 'clinic_admin', 'veterinarian', 'receptionist', 'tutor');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'inactive', 'pending', 'blocked');

-- CreateEnum
CREATE TYPE "PetSpecies" AS ENUM ('dog', 'cat', 'bird', 'reptile', 'other');

-- CreateEnum
CREATE TYPE "PetSex" AS ENUM ('male', 'female', 'unknown');

-- CreateEnum
CREATE TYPE "PetStatus" AS ENUM ('active', 'deceased', 'transferred', 'archived');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('pending', 'scheduled', 'applied', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "VaccinationStatus" AS ENUM ('confirmed', 'rectified', 'voided');

-- CreateEnum
CREATE TYPE "SharePermission" AS ENUM ('read', 'read_export');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('push', 'email', 'sms');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'failed', 'read');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('terms_of_use', 'privacy_policy', 'data_sharing_clinic', 'marketing');

-- CreateEnum
CREATE TYPE "ClinicUserRole" AS ENUM ('admin', 'receptionist');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'pending',
    "email_verified_at" TIMESTAMPTZ,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret" VARCHAR(255),
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutors" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "cpf" VARCHAR(11) NOT NULL,
    "phone" VARCHAR(20),
    "avatar_url" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tutors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veterinarians" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "crmv" VARCHAR(20) NOT NULL,
    "crmv_state" CHAR(2) NOT NULL,
    "specialty" VARCHAR(100),
    "signature_url" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "veterinarians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinics" (
    "id" UUID NOT NULL,
    "cnpj" VARCHAR(14) NOT NULL,
    "legal_name" VARCHAR(255) NOT NULL,
    "trade_name" VARCHAR(255),
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "logo_url" VARCHAR(500),
    "street" VARCHAR(255) NOT NULL,
    "number" VARCHAR(20) NOT NULL,
    "complement" VARCHAR(100),
    "neighborhood" VARCHAR(100) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" CHAR(2) NOT NULL,
    "zip_code" VARCHAR(8) NOT NULL,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_users" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "ClinicUserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "invited_at" TIMESTAMPTZ,
    "accepted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_veterinarians" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "veterinarian_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "invited_at" TIMESTAMPTZ,
    "accepted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_veterinarians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pets" (
    "id" UUID NOT NULL,
    "public_code" VARCHAR(12) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "species" "PetSpecies" NOT NULL,
    "breed" VARCHAR(100),
    "sex" "PetSex" NOT NULL DEFAULT 'unknown',
    "birth_date" DATE,
    "weight_kg" DECIMAL(5,2),
    "microchip" VARCHAR(50),
    "photo_url" VARCHAR(500),
    "status" "PetStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_pets" (
    "id" UUID NOT NULL,
    "tutor_id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "relationship" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet_shares" (
    "id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "owner_tutor_id" UUID NOT NULL,
    "guest_tutor_id" UUID,
    "guest_email" VARCHAR(255) NOT NULL,
    "permission" "SharePermission" NOT NULL DEFAULT 'read',
    "token" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "accepted_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pet_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_pet_consents" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "tutor_id" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,
    "ip_address" INET,

    CONSTRAINT "clinic_pet_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccines" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "manufacturer" VARCHAR(150),
    "species" "PetSpecies"[],
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "vaccines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccine_protocols" (
    "id" UUID NOT NULL,
    "vaccine_id" UUID NOT NULL,
    "dose_number" SMALLINT NOT NULL,
    "min_age_days" INTEGER,
    "interval_days" INTEGER,
    "is_booster" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vaccine_protocols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_vaccines" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "vaccine_id" UUID NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_vaccines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "vaccine_id" UUID NOT NULL,
    "veterinarian_id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "dose_number" SMALLINT NOT NULL DEFAULT 1,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'pending',
    "prescribed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduled_at" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccinations" (
    "id" UUID NOT NULL,
    "prescription_id" UUID,
    "pet_id" UUID NOT NULL,
    "vaccine_id" UUID NOT NULL,
    "veterinarian_id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "dose_number" SMALLINT NOT NULL,
    "batch_number" VARCHAR(50) NOT NULL,
    "batch_expiry" DATE NOT NULL,
    "application_site" VARCHAR(100),
    "applied_at" TIMESTAMPTZ NOT NULL,
    "status" "VaccinationStatus" NOT NULL DEFAULT 'confirmed',
    "next_dose_at" DATE,
    "certificate_url" VARCHAR(500),
    "qr_code_token" VARCHAR(64),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "vaccinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccination_rectifications" (
    "id" UUID NOT NULL,
    "vaccination_id" UUID NOT NULL,
    "rectified_by" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "previous_data" JSONB NOT NULL,
    "new_data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vaccination_rectifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccination_reminders" (
    "id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "tutor_id" UUID NOT NULL,
    "vaccination_id" UUID,
    "prescription_id" UUID,
    "vaccine_id" UUID NOT NULL,
    "remind_at" TIMESTAMPTZ NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vaccination_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "reference_type" VARCHAR(50),
    "reference_id" UUID,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "consent_type" "ConsentType" NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "ip_address" INET,
    "user_agent" TEXT,
    "granted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" INET,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "device_info" VARCHAR(255),
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_role_status" ON "users"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tutors_user_id_key" ON "tutors"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tutors_cpf_key" ON "tutors"("cpf");

-- CreateIndex
CREATE INDEX "idx_tutors_cpf" ON "tutors"("cpf");

-- CreateIndex
CREATE INDEX "idx_tutors_user_id" ON "tutors"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "veterinarians_user_id_key" ON "veterinarians"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "veterinarians_crmv_key" ON "veterinarians"("crmv");

-- CreateIndex
CREATE INDEX "idx_veterinarians_crmv" ON "veterinarians"("crmv");

-- CreateIndex
CREATE INDEX "idx_veterinarians_user_id" ON "veterinarians"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinics_cnpj_key" ON "clinics"("cnpj");

-- CreateIndex
CREATE INDEX "idx_clinics_cnpj" ON "clinics"("cnpj");

-- CreateIndex
CREATE INDEX "idx_clinics_city_state" ON "clinics"("city", "state");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_users_clinic_id_user_id_key" ON "clinic_users"("clinic_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_veterinarians_clinic_id_veterinarian_id_key" ON "clinic_veterinarians"("clinic_id", "veterinarian_id");

-- CreateIndex
CREATE UNIQUE INDEX "pets_public_code_key" ON "pets"("public_code");

-- CreateIndex
CREATE UNIQUE INDEX "pets_microchip_key" ON "pets"("microchip");

-- CreateIndex
CREATE INDEX "idx_pets_public_code" ON "pets"("public_code");

-- CreateIndex
CREATE INDEX "idx_pets_microchip" ON "pets"("microchip");

-- CreateIndex
CREATE INDEX "idx_pets_status" ON "pets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_pets_tutor_id_pet_id_key" ON "tutor_pets"("tutor_id", "pet_id");

-- CreateIndex
CREATE UNIQUE INDEX "pet_shares_token_key" ON "pet_shares"("token");

-- CreateIndex
CREATE UNIQUE INDEX "vaccine_protocols_vaccine_id_dose_number_key" ON "vaccine_protocols"("vaccine_id", "dose_number");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_vaccines_clinic_id_vaccine_id_key" ON "clinic_vaccines"("clinic_id", "vaccine_id");

-- CreateIndex
CREATE INDEX "idx_prescriptions_pet_id" ON "prescriptions"("pet_id");

-- CreateIndex
CREATE INDEX "idx_prescriptions_status" ON "prescriptions"("status");

-- CreateIndex
CREATE INDEX "idx_prescriptions_scheduled_at" ON "prescriptions"("scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "vaccinations_qr_code_token_key" ON "vaccinations"("qr_code_token");

-- CreateIndex
CREATE INDEX "idx_vaccinations_pet_id" ON "vaccinations"("pet_id");

-- CreateIndex
CREATE INDEX "idx_vaccinations_applied_at" ON "vaccinations"("applied_at");

-- CreateIndex
CREATE INDEX "idx_vaccinations_qr_code_token" ON "vaccinations"("qr_code_token");

-- CreateIndex
CREATE INDEX "idx_reminders_remind_at_status" ON "vaccination_reminders"("remind_at", "status");

-- CreateIndex
CREATE INDEX "idx_audit_entity" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_audit_user_id" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "idx_audit_created_at" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- AddForeignKey
ALTER TABLE "tutors" ADD CONSTRAINT "tutors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "veterinarians" ADD CONSTRAINT "veterinarians_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_users" ADD CONSTRAINT "clinic_users_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_users" ADD CONSTRAINT "clinic_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_veterinarians" ADD CONSTRAINT "clinic_veterinarians_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_veterinarians" ADD CONSTRAINT "clinic_veterinarians_veterinarian_id_fkey" FOREIGN KEY ("veterinarian_id") REFERENCES "veterinarians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_pets" ADD CONSTRAINT "tutor_pets_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_pets" ADD CONSTRAINT "tutor_pets_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_shares" ADD CONSTRAINT "pet_shares_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_shares" ADD CONSTRAINT "pet_shares_owner_tutor_id_fkey" FOREIGN KEY ("owner_tutor_id") REFERENCES "tutors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_shares" ADD CONSTRAINT "pet_shares_guest_tutor_id_fkey" FOREIGN KEY ("guest_tutor_id") REFERENCES "tutors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_pet_consents" ADD CONSTRAINT "clinic_pet_consents_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_pet_consents" ADD CONSTRAINT "clinic_pet_consents_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_pet_consents" ADD CONSTRAINT "clinic_pet_consents_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccine_protocols" ADD CONSTRAINT "vaccine_protocols_vaccine_id_fkey" FOREIGN KEY ("vaccine_id") REFERENCES "vaccines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_vaccines" ADD CONSTRAINT "clinic_vaccines_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_vaccines" ADD CONSTRAINT "clinic_vaccines_vaccine_id_fkey" FOREIGN KEY ("vaccine_id") REFERENCES "vaccines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_vaccine_id_fkey" FOREIGN KEY ("vaccine_id") REFERENCES "vaccines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_veterinarian_id_fkey" FOREIGN KEY ("veterinarian_id") REFERENCES "veterinarians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_vaccine_id_fkey" FOREIGN KEY ("vaccine_id") REFERENCES "vaccines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_veterinarian_id_fkey" FOREIGN KEY ("veterinarian_id") REFERENCES "veterinarians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_rectifications" ADD CONSTRAINT "vaccination_rectifications_vaccination_id_fkey" FOREIGN KEY ("vaccination_id") REFERENCES "vaccinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_rectifications" ADD CONSTRAINT "vaccination_rectifications_rectified_by_fkey" FOREIGN KEY ("rectified_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_reminders" ADD CONSTRAINT "vaccination_reminders_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_reminders" ADD CONSTRAINT "vaccination_reminders_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_reminders" ADD CONSTRAINT "vaccination_reminders_vaccination_id_fkey" FOREIGN KEY ("vaccination_id") REFERENCES "vaccinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_reminders" ADD CONSTRAINT "vaccination_reminders_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_reminders" ADD CONSTRAINT "vaccination_reminders_vaccine_id_fkey" FOREIGN KEY ("vaccine_id") REFERENCES "vaccines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

