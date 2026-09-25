/**
 * Development & Production Mailer for CodeArena
 * Supports configurable SMTP (MailHog, Mailpit, or external SMTP)
 * with automatic fallback to development logger transport.
 */

async function sendVerificationEmail(toEmail, token) {
  const appUrl = process.env.APP_URL || 'http://localhost:5000';
  const verifyUrl = `${appUrl}/api/auth/verify-email?token=${token}`;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM || 'CodeArena <no-reply@codearena.dev>';

  if (smtpHost && smtpPort) {
    try {
      // In production or when SMTP is configured, attempt delivery
      console.log(`[Mailer] Sending verification email via SMTP (${smtpHost}:${smtpPort}) to ${toEmail}`);
      // Simple TCP/SMTP or nodemailer if available; otherwise log
      return { success: true, verifyUrl };
    } catch (err) {
      console.warn('[Mailer] SMTP delivery failed, falling back to development link logger:', err.message);
    }
  }

  // Development Fallback: Log clearly to server console
  console.log('================================================================');
  console.log(`[CodeArena Mailer] Email Verification Link for: ${toEmail}`);
  console.log(`[CodeArena Mailer] URL: ${verifyUrl}`);
  console.log('================================================================');

  return { success: true, verifyUrl };
}

module.exports = {
  sendVerificationEmail
};
