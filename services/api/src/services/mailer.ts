import nodemailer from 'nodemailer';

function createTransport() {
  // In production use SES / SMTP credentials from env.
  // In development fall back to Ethereal (auto-created test account).
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  // Fallback: log to console (useful for local dev without SMTP)
  return nodemailer.createTransport({ jsonTransport: true });
}

const transporter = createTransport();

export async function sendVerificationEmail(
  to: string,
  displayName: string,
  token: string
): Promise<void> {
  const baseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000';
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM ?? '"Chess Portal" <no-reply@chess.example.com>',
    to,
    subject: 'Verify your Chess Portal account',
    text: [
      `Hi ${displayName},`,
      '',
      'Thanks for registering at Chess Portal.',
      'Please verify your email address by clicking the link below:',
      '',
      verifyUrl,
      '',
      'This link expires in 24 hours.',
      '',
      'If you did not create an account, you can safely ignore this email.',
    ].join('\n'),
    html: `
      <p>Hi <strong>${displayName}</strong>,</p>
      <p>Thanks for registering at Chess Portal.</p>
      <p>Please verify your email address by clicking the button below:</p>
      <p>
        <a href="${verifyUrl}" style="
          display:inline-block;
          padding:10px 20px;
          background:#1a56db;
          color:#fff;
          border-radius:4px;
          text-decoration:none;
          font-weight:bold;
        ">Verify Email</a>
      </p>
      <p>This link expires in <strong>24 hours</strong>.</p>
      <p style="color:#6b7280;font-size:12px;">If you did not create an account, you can safely ignore this email.</p>
    `,
  });

  // When using jsonTransport (dev mode) log the message so developers can see the link
  if (process.env.SMTP_HOST === undefined) {
    console.info('[mailer] Verification email (dev mode):');
    console.info('  To:', to);
    console.info('  Verify URL:', verifyUrl);
    if ((info as any).message) {
      console.debug('[mailer] Raw message:', (info as any).message);
    }
  }
}
