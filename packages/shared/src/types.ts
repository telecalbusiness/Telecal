// ============================================================
// TELECAL — SHARED TYPES
// These are the data shapes passed between server and client.
// Keep them lean — no ORM-specific types here.
// ============================================================

import {
  UserRole,
  DoctorStatus,
  DoctorPresence,
  DisciplineCategory,
  ConsultationType,
  AppointmentStatus,
  InvestigationStatus,
  PaymentStatus,
  PaymentPurpose,
  NotificationType,
  TriagePriority,
  PrescriptionStatus,
  SessionRecordingStatus,
} from './enums';

// ─── Base ────────────────────────────────────────────────────

export interface TimestampedEntity {
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// ─── User ────────────────────────────────────────────────────

export interface PublicUser extends TimestampedEntity {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatarUrl: string | null;
  isEmailVerified: boolean;
}

export interface PatientProfile extends TimestampedEntity {
  id: string;
  userId: string;
  fileNumber: string; // e.g. PT-00421
  dateOfBirth: string | null;
  gender: string | null;
  phoneNumber: string | null;
  bloodGroup: string | null;
  genotype: string | null;
  allergies: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

export interface DoctorProfile extends TimestampedEntity {
  id: string;
  userId: string;
  licenseNumber: string;
  discipline: DisciplineCategory;
  specialization: string | null;
  yearsOfExperience: number;
  bio: string | null;
  status: DoctorStatus;
  presence: DoctorPresence;
  onlineSince: string | null; // ISO 8601 — used for queue priority
  currentPatientCount: number;
  averageRating: number | null; // Admin-only visible
  availabilitySchedule: WeeklySchedule | null;
}

export interface WeeklySchedule {
  monday: TimeWindow | null;
  tuesday: TimeWindow | null;
  wednesday: TimeWindow | null;
  thursday: TimeWindow | null;
  friday: TimeWindow | null;
  saturday: TimeWindow | null;
  sunday: TimeWindow | null;
}

export interface TimeWindow {
  startTime: string; // HH:MM (24hr)
  endTime: string;   // HH:MM (24hr)
}

// ─── Appointment ─────────────────────────────────────────────

export interface Appointment extends TimestampedEntity {
  id: string;
  patientId: string;
  doctorId: string | null;
  consultationType: ConsultationType;
  discipline: DisciplineCategory | null;
  status: AppointmentStatus;
  priority: TriagePriority;
  assignedAt: string | null;
  scheduledAt: string | null;
  sessionDurationMinutes: number; // Time cap for the video call
  sessionStartedAt: string | null;
  sessionEndedAt: string | null;
  sessionRecordingStatus: SessionRecordingStatus | null;
  sessionRecordingUrl: string | null; // Encrypted, signed URL — admin only
  notes: string | null;
}

// ─── Investigation ───────────────────────────────────────────

export interface Investigation extends TimestampedEntity {
  id: string;
  patientId: string;
  appointmentId: string | null; // Linked to original appointment if returning patient
  assignedDoctorId: string | null;
  status: InvestigationStatus;
  isReturningPatient: boolean;
  reportFiles: InvestigationFile[];
  doctorNotes: string | null;
  reviewedAt: string | null;
}

export interface InvestigationFile {
  id: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  uploadedAt: string;
  // URL is never exposed to client directly — always fetched via signed endpoint
}

// ─── Payment ─────────────────────────────────────────────────

export interface Payment extends TimestampedEntity {
  id: string;
  patientId: string;
  purpose: PaymentPurpose;
  referenceId: string; // Paystack reference
  amountKobo: number; // Always store in smallest currency unit (kobo for NGN)
  currency: string;   // e.g. 'NGN'
  status: PaymentStatus;
  appointmentId: string | null;
  investigationId: string | null;
  paystackResponse: null; // Never expose raw gateway response to client
  paidAt: string | null;
}

// ─── Prescription ────────────────────────────────────────────

export interface Prescription extends TimestampedEntity {
  id: string;
  appointmentId: string;
  doctorId: string;
  patientId: string;
  status: PrescriptionStatus;
  issuedAt: string | null;
  medications: PrescriptionMedication[];
  notes: string | null;
}

export interface PrescriptionMedication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
}

// ─── Notification ────────────────────────────────────────────

export interface AppNotification extends TimestampedEntity {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  metadata: Record<string, string> | null; // e.g. { appointmentId: '...' }
}

// ─── API Response Shapes ──────────────────────────────────────

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;    // Machine-readable e.g. 'UNAUTHORIZED', 'VALIDATION_ERROR'
    message: string; // Human-readable
    details?: unknown; // Validation field errors etc.
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ─── WebSocket Event Payloads ────────────────────────────────

export interface WsPresenceUpdate {
  doctorId: string;
  presence: DoctorPresence;
  timestamp: string;
}

export interface WsAssignmentEvent {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  consultationType: ConsultationType;
  assignedAt: string;
}

export interface WsSessionSignal {
  appointmentId: string;
  fromUserId: string;
  signal: unknown; // WebRTC signaling data (offer/answer/ice-candidate)
}

export interface WsNotification {
  notification: AppNotification;
}

// ─── Pagination ───────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}
