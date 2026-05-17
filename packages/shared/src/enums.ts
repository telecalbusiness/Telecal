// ============================================================
// TELECAL — SHARED ENUMS
// Single source of truth. Used by both client and server.
// Never duplicate these values anywhere else in the codebase.
// ============================================================

export enum UserRole {
  PATIENT = 'PATIENT',
  DOCTOR = 'DOCTOR',
  ADMIN = 'ADMIN',
}

export enum DoctorStatus {
  PENDING_VERIFICATION = 'PENDING_VERIFICATION', // Submitted, awaiting admin review
  VERIFIED = 'VERIFIED',                          // Approved, can go online
  REJECTED = 'REJECTED',                          // Credentials rejected
  SUSPENDED = 'SUSPENDED',                        // Admin-suspended account
}

export enum DoctorPresence {
  ONLINE = 'ONLINE',   // Actively available for assignments
  OFFLINE = 'OFFLINE', // Not available
  BUSY = 'BUSY',       // In an active session, no new assignments
}

export enum DisciplineCategory {
  GENERAL_PRACTICE = 'GENERAL_PRACTICE',
  DENTISTRY = 'DENTISTRY',
  OPHTHALMOLOGY = 'OPHTHALMOLOGY',
  CARDIOLOGY = 'CARDIOLOGY',
  DERMATOLOGY = 'DERMATOLOGY',
  NEUROLOGY = 'NEUROLOGY',
  ORTHOPEDICS = 'ORTHOPEDICS',
  PEDIATRICS = 'PEDIATRICS',
  PSYCHIATRY = 'PSYCHIATRY',
  GYNECOLOGY = 'GYNECOLOGY',
  UROLOGY = 'UROLOGY',
  ENT = 'ENT',                   // Ear, Nose & Throat
  RADIOLOGY = 'RADIOLOGY',
  ONCOLOGY = 'ONCOLOGY',
  ENDOCRINOLOGY = 'ENDOCRINOLOGY',
}

export enum ConsultationType {
  GENERAL_PRACTICE = 'GENERAL_PRACTICE',
  SPECIALIST = 'SPECIALIST',
}

export enum AppointmentStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',     // Created, awaiting payment
  PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED', // Paid, awaiting doctor assignment
  ASSIGNED = 'ASSIGNED',                   // Doctor assigned, awaiting session
  IN_SESSION = 'IN_SESSION',               // Video call active
  COMPLETED = 'COMPLETED',                 // Session ended normally
  CANCELLED = 'CANCELLED',                 // Cancelled before session
  TIMED_OUT = 'TIMED_OUT',                 // Session ended by time limit
  NO_SHOW = 'NO_SHOW',                     // Patient/doctor did not join
}

export enum InvestigationStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',     // Awaiting payment
  PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED', // Paid, report upload unlocked
  REPORT_UPLOADED = 'REPORT_UPLOADED',     // Patient uploaded report
  ASSIGNED = 'ASSIGNED',                   // Doctor assigned to review
  UNDER_REVIEW = 'UNDER_REVIEW',           // Doctor reviewing
  REVIEWED = 'REVIEWED',                   // Doctor completed review
}

export enum PaymentStatus {
  PENDING = 'PENDING',       // Payment initiated
  SUCCESSFUL = 'SUCCESSFUL', // Paystack confirmed
  FAILED = 'FAILED',         // Payment failed
  REFUNDED = 'REFUNDED',     // Admin-initiated refund
}

export enum PaymentPurpose {
  CONSULTATION = 'CONSULTATION',
  INVESTIGATION_NEW = 'INVESTIGATION_NEW',        // First-time investigation
  INVESTIGATION_RETURNING = 'INVESTIGATION_RETURNING', // Discounted follow-up
}

export enum SessionRecordingStatus {
  PENDING = 'PENDING',         // Session created, not started
  RECORDING = 'RECORDING',     // Actively recording
  PROCESSING = 'PROCESSING',   // Recording ended, being encoded/uploaded
  STORED = 'STORED',           // Saved to encrypted storage
  FAILED = 'FAILED',           // Recording/storage error
}

export enum NotificationType {
  APPOINTMENT_ASSIGNED = 'APPOINTMENT_ASSIGNED',
  APPOINTMENT_REMINDER = 'APPOINTMENT_REMINDER',
  SESSION_STARTING = 'SESSION_STARTING',
  SESSION_ENDED = 'SESSION_ENDED',
  INVESTIGATION_ASSIGNED = 'INVESTIGATION_ASSIGNED',
  INVESTIGATION_REVIEWED = 'INVESTIGATION_REVIEWED',
  PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PRESCRIPTION_READY = 'PRESCRIPTION_READY',
  DOCTOR_APPROVED = 'DOCTOR_APPROVED',
  DOCTOR_REJECTED = 'DOCTOR_REJECTED',
  EMERGENCY_TRIAGE = 'EMERGENCY_TRIAGE',
  EARNINGS_CREDITED = 'EARNINGS_CREDITED',
  PAYOUT_PROCESSED = 'PAYOUT_PROCESSED',
}

export enum TriagePriority {
  NORMAL = 'NORMAL',
  URGENT = 'URGENT',
}

export enum PrescriptionStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED', // Finalized and sent to patient
}

export enum AuditAction {
  // Auth
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  // Records access
  RECORD_VIEWED = 'RECORD_VIEWED',
  RECORD_MODIFIED = 'RECORD_MODIFIED',
  INVESTIGATION_ACCESSED = 'INVESTIGATION_ACCESSED',
  RECORDING_ACCESSED = 'RECORDING_ACCESSED',
  // Admin actions
  DOCTOR_APPROVED = 'DOCTOR_APPROVED',
  DOCTOR_REJECTED = 'DOCTOR_REJECTED',
  DOCTOR_SUSPENDED = 'DOCTOR_SUSPENDED',
  PAYMENT_REFUNDED = 'PAYMENT_REFUNDED',
  // Assignment
  PATIENT_ASSIGNED = 'PATIENT_ASSIGNED',
  // Earnings & Payouts
  EARNINGS_CREDITED = 'EARNINGS_CREDITED',
  PAYOUT_INITIATED = 'PAYOUT_INITIATED',
  PAYOUT_COMPLETED = 'PAYOUT_COMPLETED',
  PAYOUT_FAILED = 'PAYOUT_FAILED',
}
