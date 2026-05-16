-- DropIndex
DROP INDEX "appointments_doctorId_idx";

-- DropIndex
DROP INDEX "appointments_patientId_idx";

-- DropIndex
DROP INDEX "appointments_status_idx";

-- DropIndex
DROP INDEX "audit_logs_action_createdAt_idx";

-- DropIndex
DROP INDEX "audit_logs_userId_createdAt_idx";

-- DropIndex
DROP INDEX "doctor_credentials_doctorId_idx";

-- DropIndex
DROP INDEX "investigations_assignedDoctorId_idx";

-- DropIndex
DROP INDEX "investigations_patientId_idx";

-- DropIndex
DROP INDEX "notifications_userId_createdAt_idx";

-- DropIndex
DROP INDEX "notifications_userId_isRead_idx";

-- CreateIndex
CREATE INDEX "appointments_patientId_createdAt_idx" ON "appointments"("patientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "appointments_doctorId_createdAt_idx" ON "appointments"("doctorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "appointments_status_createdAt_idx" ON "appointments"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "appointments_status_priority_createdAt_idx" ON "appointments"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "appointments_deletedAt_createdAt_idx" ON "appointments"("deletedAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_userId_action_createdAt_idx" ON "audit_logs"("userId", "action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "doctor_admin_reviews_adminId_reviewedAt_idx" ON "doctor_admin_reviews"("adminId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "doctor_credentials_doctorId_uploadedAt_idx" ON "doctor_credentials"("doctorId", "uploadedAt" DESC);

-- CreateIndex
CREATE INDEX "doctor_profiles_status_presence_currentPatientCount_onlineS_idx" ON "doctor_profiles"("status", "presence", "currentPatientCount", "onlineSince");

-- CreateIndex
CREATE INDEX "doctor_profiles_createdAt_idx" ON "doctor_profiles"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "investigations_patientId_createdAt_idx" ON "investigations"("patientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "investigations_assignedDoctorId_createdAt_idx" ON "investigations"("assignedDoctorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "investigations_assignedDoctorId_status_idx" ON "investigations"("assignedDoctorId", "status");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_id_idx" ON "notifications"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "patient_profiles_createdAt_idx" ON "patient_profiles"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "payments_status_paidAt_idx" ON "payments"("status", "paidAt" DESC);

-- CreateIndex
CREATE INDEX "payments_patientId_createdAt_idx" ON "payments"("patientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "prescriptions_patientId_status_issuedAt_idx" ON "prescriptions"("patientId", "status", "issuedAt" DESC);

-- CreateIndex
CREATE INDEX "prescriptions_doctorId_status_idx" ON "prescriptions"("doctorId", "status");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_revokedAt_expiresAt_idx" ON "refresh_tokens"("userId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "users_role_createdAt_idx" ON "users"("role", "createdAt" DESC);
