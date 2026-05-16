
// Consultation Fees (in Kobo — 1 NGN = 100 Kobo)

export const FEES = {
  GENERAL_PRACTICE_KOBO: 500_000,          // ₦5,000
  SPECIALIST_KOBO: 750_000,                 // ₦7,500
  INVESTIGATION_NEW_KOBO: 300_000,          // ₦3,000 — first investigation
  INVESTIGATION_RETURNING_KOBO: 150_000,    // ₦1,500 — discounted follow-up
} as const;

// Session Time Limits 
export const SESSION_LIMITS = {
  GENERAL_PRACTICE_MINUTES: 20,
  SPECIALIST_MINUTES: 30,
  WARNING_BEFORE_END_SECONDS: 120, // Warn both parties 2 minutes before end
  GRACE_PERIOD_SECONDS: 60,        // Extra 60s before hard disconnect
} as const;

//  Assignment Engine 
export const ASSIGNMENT = {
  MAX_PATIENTS_PER_DOCTOR: 5,
  QUEUE_CHECK_INTERVAL_MS: 5_000,
  ASSIGNMENT_TIMEOUT_MINUTES: 10,
} as const;

//  File Upload Limits
export const FILE_LIMITS = {
  MAX_INVESTIGATION_FILES: 5,
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB per file
  ALLOWED_REPORT_MIME_TYPES: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ],
  ALLOWED_CREDENTIAL_MIME_TYPES: [
    'application/pdf',
    'image/jpeg',
    'image/png',
  ],
  MAX_CREDENTIAL_FILES: 5,
} as const;

// Auth 
export const AUTH = {
  ACCESS_TOKEN_EXPIRY: '15m',
  REFRESH_TOKEN_EXPIRY: '7d',
  EMAIL_VERIFICATION_EXPIRY_HOURS: 24,
  PASSWORD_RESET_EXPIRY_MINUTES: 30,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 15,
  BCRYPT_ROUNDS: 12,
  FILE_NUMBER_PREFIX: 'TC',
} as const;

//  Pagination Defaults
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

//  WebSocket Events 

export const WS_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  // Presence
  DOCTOR_GO_ONLINE: 'doctor:go_online',
  DOCTOR_GO_OFFLINE: 'doctor:go_offline',
  PRESENCE_UPDATE: 'presence:update',
  // Assignment
  PATIENT_QUEUED: 'assignment:patient_queued',
  DOCTOR_ASSIGNED: 'assignment:doctor_assigned',
  // Session / WebRTC signaling
  SESSION_OFFER: 'session:offer',
  SESSION_ANSWER: 'session:answer',
  SESSION_ICE_CANDIDATE: 'session:ice_candidate',
  SESSION_START: 'session:start',
  SESSION_END: 'session:end',
  SESSION_TIME_WARNING: 'session:time_warning',
  SESSION_RECORDING_READY: 'session:recording_ready',
  // Notifications
  NOTIFICATION: 'notification:new',
} as const;

// Audit Log 
export const AUDIT = {
  RETENTION_DAYS: 2555, // 7 years — standard for medical records
} as const;

// Paystack 
export const PAYSTACK = {
  BASE_URL: 'https://api.paystack.co',
  CURRENCY: 'NGN',
} as const;
