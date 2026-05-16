-- CreateTable
CREATE TABLE "appointment_reviews" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "appointment_reviews_appointmentId_key" ON "appointment_reviews"("appointmentId");

-- CreateIndex
CREATE INDEX "appointment_reviews_doctorId_createdAt_idx" ON "appointment_reviews"("doctorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "appointment_reviews_patientId_idx" ON "appointment_reviews"("patientId");

-- AddForeignKey
ALTER TABLE "appointment_reviews" ADD CONSTRAINT "appointment_reviews_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_reviews" ADD CONSTRAINT "appointment_reviews_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_reviews" ADD CONSTRAINT "appointment_reviews_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
