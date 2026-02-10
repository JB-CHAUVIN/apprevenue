const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../utils/logger');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }
  return transporter;
}

async function sendVerificationEmail(email, token) {
  const verifyUrl = `${config.appUrl}/verify-email?token=${token}`;
  const html = `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:40px;background:#0f172a;color:#e2e8f0;border-radius:16px;">
      <h2 style="color:#00f0ff;margin-bottom:24px;">Verify Your Email</h2>
      <p>Welcome to AppRevenue! Click the button below to verify your email address:</p>
      <a href="${verifyUrl}" style="display:inline-block;margin:24px 0;padding:14px 32px;background:#00f0ff;color:#050816;font-weight:600;border-radius:12px;text-decoration:none;">Verify Email</a>
      <p style="color:#94a3b8;font-size:14px;">Or copy this link: ${verifyUrl}</p>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">This link expires in 24 hours.</p>
    </div>
  `;

  await getTransporter().sendMail({
    from: config.smtp.from,
    to: email,
    subject: 'AppRevenue — Verify Your Email',
    html,
  });
  logger.info(`Verification email sent to ${email}`);
}

async function sendWelcomeEmail(email) {
  const html = `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:40px;background:#0f172a;color:#e2e8f0;border-radius:16px;">
      <h2 style="color:#00f0ff;margin-bottom:24px;">Welcome to AppRevenue!</h2>
      <p>Your account is verified and ready to go. Start connecting your revenue sources now.</p>
      <a href="${config.appUrl}/dashboard" style="display:inline-block;margin:24px 0;padding:14px 32px;background:#00f0ff;color:#050816;font-weight:600;border-radius:12px;text-decoration:none;">Go to Dashboard</a>
    </div>
  `;

  await getTransporter().sendMail({
    from: config.smtp.from,
    to: email,
    subject: 'Welcome to AppRevenue!',
    html,
  });
}

module.exports = { sendVerificationEmail, sendWelcomeEmail };
