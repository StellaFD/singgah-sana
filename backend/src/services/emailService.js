const { getAppOrigin, getMailConfig, getMailTransporter } = require('../config/mail');

function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPasswordResetEmail({ name, resetUrl }) {
  const safeName = escapeHtml(name || 'Pengguna Singgah Sana');
  const safeUrl = escapeHtml(resetUrl);

  const subject = 'Pemulihan Kata Sandi - Singgah Sana';

  const text = `Halo ${name || 'Pengguna'},\n\nKami menerima permintaan pemulihan kata sandi untuk akun Singgah Sana kamu.\n\nBuka tautan berikut untuk membuat kata sandi baru (berlaku 30 menit):\n${resetUrl}\n\nJika kamu tidak meminta pemulihan ini, abaikan email ini. Kata sandi akunmu tetap aman.\n\nSalam,\nTim Singgah Sana`;

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 32px 32px 24px 32px; background-color: #7C3AED; text-align: left;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">Singgah Sana</h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #ede9fe;">Pencarian dan Pengelolaan Kost</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #0f172a;">Pemulihan Kata Sandi</h2>
              <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155;">Halo <strong>${safeName}</strong>,</p>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #334155;">Kami menerima permintaan untuk mengatur ulang kata sandi akun Singgah Sana kamu. Klik tombol di bawah ini untuk membuat kata sandi baru:</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #7C3AED;">
                    <a href="${safeUrl}" target="_blank" rel="noreferrer" style="display: inline-block; padding: 12px 24px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">Atur Ulang Kata Sandi</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b;">Tautan ini hanya berlaku selama <strong>30 menit</strong> dan hanya dapat digunakan satu kali.</p>
              <p style="margin: 0 0 16px 0; font-size: 12px; color: #94a3b8; word-break: break-all;">Jika tombol di atas tidak berfungsi, salin dan tempel tautan berikut ke browser kamu:<br><a href="${safeUrl}" rel="noreferrer" style="color: #7C3AED;">${safeUrl}</a></p>
              <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">Jika kamu tidak meminta pengaturan ulang kata sandi, abaikan email ini dengan aman. Akunmu tetap terlindungi.</p>
            </td>
          </tr>
        </table>
        <p style="margin: 24px 0 0 0; font-size: 12px; color: #94a3b8; text-align: center;">&copy; 2026 Singgah Sana. Seluruh hak cipta dilindungi.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

function renderEmailVerificationEmail({ name, verifyUrl }) {
  const safeName = escapeHtml(name || 'Pengguna Singgah Sana');
  const safeUrl = escapeHtml(verifyUrl);

  const subject = 'Verifikasi Alamat Email - Singgah Sana';

  const text = `Halo ${name || 'Pengguna'},\n\nTerima kasih telah bergabung di Singgah Sana.\n\nBuka tautan berikut untuk memverifikasi alamat email kamu (berlaku 24 jam):\n${verifyUrl}\n\nSetelah diverifikasi, alamat email kamu akan ditandai sebagai email terkonfirmasi pada akun Singgah Sana.\n\nSalam,\nTim Singgah Sana`;

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 32px 32px 24px 32px; background-color: #7C3AED; text-align: left;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">Singgah Sana</h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #ede9fe;">Pencarian dan Pengelolaan Kost</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #0f172a;">Verifikasi Alamat Email</h2>
              <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155;">Halo <strong>${safeName}</strong>,</p>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #334155;">Terima kasih telah mendaftar di Singgah Sana. Mohon konfirmasi kepemilikan alamat email kamu dengan menekan tombol berikut:</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #7C3AED;">
                    <a href="${safeUrl}" target="_blank" rel="noreferrer" style="display: inline-block; padding: 12px 24px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">Verifikasi Email Saya</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b;">Tautan ini berlaku selama <strong>24 jam</strong> dan hanya dapat digunakan satu kali.</p>
              <p style="margin: 0 0 16px 0; font-size: 12px; color: #94a3b8; word-break: break-all;">Jika tombol di atas tidak berfungsi, salin dan tempel tautan berikut ke browser kamu:<br><a href="${safeUrl}" rel="noreferrer" style="color: #7C3AED;">${safeUrl}</a></p>
              <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">Jika kamu tidak pernah mendaftar di Singgah Sana, kamu dapat mengabaikan email ini dengan aman.</p>
            </td>
          </tr>
        </table>
        <p style="margin: 24px 0 0 0; font-size: 12px; color: #94a3b8; text-align: center;">&copy; 2026 Singgah Sana. Seluruh hak cipta dilindungi.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

async function sendTransactionalMail({ toEmail, toName, subject, text, html }) {
  const config = getMailConfig();

  if (!config.isConfigured) {
    const error = new Error('Layanan email belum dikonfigurasi.');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }

  if (config.transportMode === 'https_api') {
    // Kirim via Brevo HTTPS REST API (Port 443 - aman dari firewall cloud)
    const payload = {
      sender: {
        name: config.senderName,
        email: config.senderEmail,
      },
      to: [
        {
          email: toEmail,
          name: toName || 'Pengguna Singgah Sana',
        },
      ],
      subject,
      htmlContent: html,
      textContent: text,
    };

    let response;
    try {
      response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': config.apiKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // Timeout 10 detik agar tidak melebihi gateway 15s
      });
    } catch (err) {
      const errCode = (err && typeof err.name === 'string' && err.name === 'TimeoutError') ? 'ETIMEDOUT' : 'NETWORK_ERROR';
      console.error(`[Mail Error] Pengiriman via Brevo HTTPS API gagal: ${errCode}`);
      const deliveryError = new Error('Pengiriman email gagal.');
      deliveryError.code = errCode;
      throw deliveryError;
    }

    if (!response.ok) {
      let errBody = {};
      try {
        errBody = await response.json();
      } catch {}
      const safeErrCode = (errBody && typeof errBody.code === 'string') ? errBody.code : `HTTP_${response.status}`;
      console.error(`[Mail Error] Brevo HTTPS API menolak pengiriman: ${safeErrCode} (status: ${response.status})`);
      const deliveryError = new Error('Pengiriman email ditolak oleh penyedia layanan.');
      deliveryError.code = safeErrCode;
      deliveryError.statusCode = response.status;
      throw deliveryError;
    }

    let result = {};
    try {
      result = await response.json();
    } catch {}
    const safeMsgId = (result && typeof result.messageId === 'string') ? result.messageId : 'accepted';
    console.log(`[Mail] Email berhasil dikirim via Brevo HTTPS API (messageId: ${safeMsgId})`);
    return { success: true, messageId: safeMsgId };
  }

  // Fallback: Kirim via Nodemailer SMTP (Port 587 / 2525)
  const transporter = getMailTransporter();
  if (!transporter) {
    const error = new Error('Transporter SMTP belum tersedia.');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }

  try {
    const info = await transporter.sendMail({
      from: config.from,
      to: toEmail,
      subject,
      text,
      html,
    });
    console.log(`[Mail] Email berhasil dikirim via Brevo SMTP (messageId: ${info?.messageId || 'accepted'})`);
    return { success: true, messageId: info?.messageId };
  } catch (err) {
    const sanitizedCode = (err && typeof err.code === 'string') ? err.code : 'MAIL_DELIVERY_FAILED';
    console.error(`[Mail Error] Pengiriman email via SMTP gagal: ${sanitizedCode}`);
    const deliveryError = new Error('Pengiriman email gagal.');
    deliveryError.code = sanitizedCode;
    throw deliveryError;
  }
}

async function sendPasswordResetEmail(toEmail, toName, rawToken) {
  const appOrigin = getAppOrigin();
  // Gunakan fragment URI (#token=...) agar token tidak pernah terkirim ke access log server web / Next.js
  const resetUrl = `${appOrigin}/reset-sandi#token=${encodeURIComponent(rawToken)}`;
  const { subject, text, html } = renderPasswordResetEmail({ name: toName, resetUrl });

  return sendTransactionalMail({
    toEmail,
    toName,
    subject,
    text,
    html,
  });
}

async function sendVerificationEmail(toEmail, toName, rawToken) {
  const appOrigin = getAppOrigin();
  // Gunakan fragment URI (#token=...) agar token tidak pernah terkirim ke access log server web / Next.js
  const verifyUrl = `${appOrigin}/verifikasi-email/konfirmasi#token=${encodeURIComponent(rawToken)}`;
  const { subject, text, html } = renderEmailVerificationEmail({ name: toName, verifyUrl });

  return sendTransactionalMail({
    toEmail,
    toName,
    subject,
    text,
    html,
  });
}

module.exports = {
  escapeHtml,
  renderPasswordResetEmail,
  renderEmailVerificationEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendTransactionalMail,
};
