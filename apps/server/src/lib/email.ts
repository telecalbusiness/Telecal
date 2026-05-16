// ============================================================
// Telecal — EMAIL SERVICE
// Nodemailer-based transactional email with HTML templates.
// All emails are queue-safe: failures are logged but never
// crash the main request flow.
// ============================================================

import nodemailer from 'nodemailer';
import { config, isProd } from '../config';
import { logger } from './logger';

// ─── Transporter ─────────────────────────────────────────────

let transporter: nodemailer.Transporter | null = null;

const getTransporter = (): nodemailer.Transporter => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT ?? 587,
    secure: config.SMTP_SECURE ?? false,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
    // Verify connection on first use
    pool: true,
    maxConnections: 5,
  });

  return transporter;
};

// ─── Base HTML template ───────────────────────────────────────

const baseTemplate = (content: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Telecal</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #f0fdf9; color: #0f2d2b; }
    .wrapper { max-width: 560px; margin: 32px auto; padding: 0 16px; }
    .card { background: #ffffff; border-radius: 16px; padding: 40px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); }
    .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 32px; }
    .logo-mark { width: 36px; height: 36px; background: #0d9488; border-radius: 10px;
                 display: flex; align-items: center; justify-content: center;
                 font-size: 18px; color: white; }
    .logo-text { font-size: 18px; font-weight: 600; color: #0f2d2b; letter-spacing: -0.02em; }
    h1 { font-size: 22px; font-weight: 600; color: #0f2d2b; margin-bottom: 8px;
         letter-spacing: -0.02em; }
    p { font-size: 15px; line-height: 1.6; color: #374151; margin-bottom: 12px; }
    .highlight { background: #f0fdf9; border-radius: 10px; padding: 16px; margin: 20px 0;
                 border-left: 3px solid #0d9488; }
    .highlight p { margin: 0; }
    .btn { display: inline-block; background: #0d9488; color: #ffffff !important;
           padding: 12px 28px; border-radius: 10px; text-decoration: none;
           font-weight: 500; font-size: 15px; margin: 20px 0; }
    .btn:hover { background: #0f766e; }
    .divider { height: 1px; background: #e6f7f4; margin: 24px 0; }
    .footer { text-align: center; margin-top: 24px; font-size: 13px; color: #6b7280; }
    .footer a { color: #0d9488; text-decoration: none; }
    .warning { background: #fef9c3; border-radius: 10px; padding: 14px;
               margin: 16px 0; border-left: 3px solid #f59e0b; }
    .danger  { background: #fef2f2; border-radius: 10px; padding: 14px;
               margin: 16px 0; border-left: 3px solid #ef4444; }
    .success { background: #f0fdf4; border-radius: 10px; padding: 14px;
               margin: 16px 0; border-left: 3px solid #10b981; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="logo">
        <div class="logo-mark">+</div>
        <span class="logo-text">Telecal</span>
      </div>
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Telecal. All rights reserved.</p>
      <p><a href="#">Privacy Policy</a> &middot; <a href="#">Terms of Service</a></p>
    </div>
  </div>
</body>
</html>
`;

// ─── Send helper ──────────────────────────────────────────────

interface SendOptions {
  to: string;
  subject: string;
  html: string;
}

const send = async (opts: SendOptions): Promise<void> => {
  if (!isProd && !config.SMTP_USER) {
    // In dev without SMTP config, just log the email
    logger.info('Email (dev mode — not sent)', {
      to: opts.to,
      subject: opts.subject,
    });
    return;
  }

  try {
    const info = await getTransporter().sendMail({
      from: `"${config.EMAIL_FROM_NAME}" <${config.EMAIL_FROM_ADDRESS}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    logger.info('Email sent', { to: opts.to, messageId: info.messageId });
  } catch (err) {
    // NEVER throw — email failure must not break the main flow
    logger.error('Email send failed', { to: opts.to, subject: opts.subject, err });
  }
};

// ─── Email templates ──────────────────────────────────────────

export const emailService = {

  // ── Doctor assigned to patient ──────────────────────────────
  async sendDoctorAssigned(opts: {
    doctorEmail: string;
    doctorFirstName: string;
    patientFirstName: string;
    patientFileNumber: string;
    consultationType: string;
    appointmentId: string;
  }) {
    const dashboardUrl = `${config.CLIENT_URL}/dashboard/appointments/${opts.appointmentId}`;
    await send({
      to: opts.doctorEmail,
      subject: `New patient assigned — ${opts.patientFirstName}`,
      html: baseTemplate(`
        <h1>New patient assigned</h1>
        <p>Hello Dr. ${opts.doctorFirstName},</p>
        <p>A patient has been assigned to you and is waiting for your consultation.</p>
        <div class="highlight">
          <p><strong>Patient:</strong> ${opts.patientFirstName}</p>
          <p><strong>File number:</strong> ${opts.patientFileNumber}</p>
          <p><strong>Consultation type:</strong> ${opts.consultationType.replace(/_/g, ' ')}</p>
        </div>
        <p>Please log in to your dashboard to join the session.</p>
        <a href="${dashboardUrl}" class="btn">Go to appointment</a>
        <div class="divider"></div>
        <p style="font-size:13px;color:#6b7280;">
          The session timer starts when both parties have joined.
        </p>
      `),
    });
  },

  // ── Patient notified of assignment ──────────────────────────
  async sendPatientAssigned(opts: {
    patientEmail: string;
    patientFirstName: string;
    doctorFirstName: string;
    doctorDiscipline: string;
    appointmentId: string;
  }) {
    const dashboardUrl = `${config.CLIENT_URL}/dashboard/appointments/${opts.appointmentId}`;
    await send({
      to: opts.patientEmail,
      subject: 'Your doctor has been assigned',
      html: baseTemplate(`
        <h1>Doctor assigned</h1>
        <p>Hello ${opts.patientFirstName},</p>
        <p>Great news — a doctor has been assigned to your consultation request.</p>
        <div class="highlight">
          <p><strong>Doctor:</strong> Dr. ${opts.doctorFirstName}</p>
          <p><strong>Specialty:</strong> ${opts.doctorDiscipline.replace(/_/g, ' ')}</p>
        </div>
        <p>You can join the video session from your appointment page.</p>
        <a href="${dashboardUrl}" class="btn">Join session</a>
      `),
    });
  },

  // ── Doctor approved by admin ────────────────────────────────
  async sendDoctorApproved(opts: {
    doctorEmail: string;
    doctorFirstName: string;
  }) {
    await send({
      to: opts.doctorEmail,
      subject: 'Your Telecal account has been approved',
      html: baseTemplate(`
        <h1>Account approved ✓</h1>
        <p>Hello Dr. ${opts.doctorFirstName},</p>
        <p>
          Your credentials have been verified and your Telecal account is now active.
          You can now log in, go online, and start accepting patient consultations.
        </p>
        <div class="success">
          <p>Your account is fully verified and ready to use.</p>
        </div>
        <a href="${config.CLIENT_URL}/auth/login" class="btn">Log in to your dashboard</a>
        <div class="divider"></div>
        <p style="font-size:13px;color:#6b7280;">
          Once logged in, click "Go online" on your dashboard to start receiving patients.
        </p>
      `),
    });
  },

  // ── Doctor rejected by admin ────────────────────────────────
  async sendDoctorRejected(opts: {
    doctorEmail: string;
    doctorFirstName: string;
    reason: string;
  }) {
    await send({
      to: opts.doctorEmail,
      subject: 'Telecal — Account verification update',
      html: baseTemplate(`
        <h1>Account verification update</h1>
        <p>Hello Dr. ${opts.doctorFirstName},</p>
        <p>
          We were unable to verify your credentials at this time.
        </p>
        <div class="danger">
          <p><strong>Reason:</strong> ${opts.reason}</p>
        </div>
        <p>
          If you believe this is an error or would like to resubmit your credentials,
          please contact our support team.
        </p>
        <a href="mailto:support@Telecal.com" class="btn">Contact support</a>
      `),
    });
  },

  // ── Password reset ──────────────────────────────────────────
  async sendPasswordReset(opts: {
    email: string;
    firstName: string;
    resetToken: string;
  }) {
    const resetUrl = `${config.CLIENT_URL}/auth/reset-password?token=${opts.resetToken}`;
    await send({
      to: opts.email,
      subject: 'Reset your Telecal password',
      html: baseTemplate(`
        <h1>Reset your password</h1>
        <p>Hello ${opts.firstName},</p>
        <p>
          You requested a password reset. Click the button below to set a new password.
          This link expires in 30 minutes.
        </p>
        <a href="${resetUrl}" class="btn">Reset password</a>
        <div class="warning">
          <p>
            If you didn't request this, please ignore this email.
            Your password will not change.
          </p>
        </div>
        <div class="divider"></div>
        <p style="font-size:13px;color:#6b7280;">
          For security, this link can only be used once and expires in 30 minutes.
          If it has expired, request a new one at the login page.
        </p>
      `),
    });
  },

  // ── Email verification ──────────────────────────────────────
  async sendEmailVerification(opts: {
    email: string;
    firstName: string;
    verifyToken: string;
  }) {
    const verifyUrl = `${config.CLIENT_URL}/auth/verify-email?token=${opts.verifyToken}`;
    await send({
      to: opts.email,
      subject: 'Verify your Telecal email address',
      html: baseTemplate(`
        <h1>Verify your email</h1>
        <p>Hello ${opts.firstName},</p>
        <p>
          Thanks for registering with Telecal. Please verify your email address
          to activate your account.
        </p>
        <a href="${verifyUrl}" class="btn">Verify email address</a>
        <div class="divider"></div>
        <p style="font-size:13px;color:#6b7280;">
          This link expires in 24 hours. If you didn't create an account, ignore this email.
        </p>
      `),
    });
  },

  // ── Investigation reviewed ──────────────────────────────────
  async sendInvestigationReviewed(opts: {
    patientEmail: string;
    patientFirstName: string;
    investigationId: string;
  }) {
    const url = `${config.CLIENT_URL}/dashboard/investigations/${opts.investigationId}`;
    await send({
      to: opts.patientEmail,
      subject: 'Your investigation report has been reviewed',
      html: baseTemplate(`
        <h1>Investigation reviewed</h1>
        <p>Hello ${opts.patientFirstName},</p>
        <p>
          A doctor has completed their review of your investigation report.
          You can now view the findings and any recommendations in your dashboard.
        </p>
        <a href="${url}" class="btn">View review</a>
      `),
    });
  },

  // ── Prescription issued ─────────────────────────────────────
  async sendPrescriptionIssued(opts: {
    patientEmail: string;
    patientFirstName: string;
    doctorFirstName: string;
    appointmentId: string;
    medicationCount: number;
  }) {
    const url = `${config.CLIENT_URL}/dashboard/appointments/${opts.appointmentId}`;
    await send({
      to: opts.patientEmail,
      subject: 'New prescription from Dr. ' + opts.doctorFirstName,
      html: baseTemplate(`
        <h1>Prescription issued</h1>
        <p>Hello ${opts.patientFirstName},</p>
        <p>
          Dr. ${opts.doctorFirstName} has issued a prescription for you containing
          <strong>${opts.medicationCount} medication${opts.medicationCount !== 1 ? 's' : ''}</strong>.
        </p>
        <p>View the full details and medications in your appointment record.</p>
        <a href="${url}" class="btn">View prescription</a>
        <div class="warning">
          <p>
            Please consult with a pharmacist before taking any medication.
            Follow the dosage instructions exactly as prescribed.
          </p>
        </div>
      `),
    });
  },

  // ── Payment confirmed ───────────────────────────────────────
  async sendPaymentConfirmed(opts: {
    patientEmail: string;
    patientFirstName: string;
    amountNGN: string;
    reference: string;
    purpose: string;
  }) {
    await send({
      to: opts.patientEmail,
      subject: `Payment confirmed — ₦${opts.amountNGN}`,
      html: baseTemplate(`
        <h1>Payment confirmed</h1>
        <p>Hello ${opts.patientFirstName},</p>
        <p>Your payment has been received and processed successfully.</p>
        <div class="highlight">
          <p><strong>Amount:</strong> ₦${opts.amountNGN}</p>
          <p><strong>Purpose:</strong> ${opts.purpose}</p>
          <p><strong>Reference:</strong> ${opts.reference}</p>
        </div>
        <p>
          The system is now finding an available doctor for your consultation.
          You'll receive another notification when a doctor is assigned.
        </p>
        <a href="${config.CLIENT_URL}/dashboard" class="btn">Go to dashboard</a>
      `),
    });
  },
};
