const nodemailer = require('nodemailer');

/**
 * Konfigurasi SMTP Brevo & Layanan Email Singgah Sana
 *
 * Menggunakan kredensial Brevo SMTP yang dikonfigurasi via environment variable:
 * - BREVO_SMTP_HOST (default: smtp-relay.brevo.com)
 * - BREVO_SMTP_PORT (default: 587)
 * - BREVO_SMTP_USER (login SMTP pada halaman Brevo)
 * - BREVO_SMTP_KEY (kunci SMTP Brevo)
 * - MAIL_FROM (nama & alamat pengirim yang terverifikasi)
 * - APP_ORIGIN (origin webapp untuk tautan absolut)
 */

function getAppOrigin() {
  const raw = process.env.APP_ORIGIN;
  const origins = (typeof raw === 'string' ? raw : '')
    .split(',')
    .map(o => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const primary = origins[0] || '';
  if (primary) {
    try {
      const parsed = new URL(primary);
      const isProd = process.env.NODE_ENV === 'production';
      // Di produksi wajib HTTPS, di dev/test boleh HTTP/HTTPS
      if (isProd && parsed.protocol !== 'https:') {
        return '';
      }
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return '';
      }
      // Dilarang membawa credential (user:pass), query, atau fragment
      if (parsed.username || parsed.password) {
        return '';
      }
      if (parsed.search || parsed.hash) {
        return '';
      }
      // Di mode development, jika origin menunjuk ke default port 3000 sementara server berjalan di 3120
      if (!isProd && parsed.hostname === 'localhost' && parsed.port === '3000') {
        return 'http://localhost:3120';
      }
      return parsed.origin;
    } catch {
      return '';
    }
  }
  return process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3120';
}

function getMailConfig() {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  const host = (process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com').trim();
  const port = parseInt(process.env.BREVO_SMTP_PORT || '587', 10);
  const user = (process.env.BREVO_SMTP_USER || '').trim();
  const pass = (process.env.BREVO_SMTP_KEY || '').trim();
  let from = (process.env.MAIL_FROM || '').trim();

  // Bersihkan tanda kutip pembungkus jika ada
  if ((from.startsWith('"') && from.endsWith('"')) || (from.startsWith("'") && from.endsWith("'"))) {
    from = from.slice(1, -1).trim();
  }

  // APP_ORIGIN wajib terverifikasi valid agar sistem tidak pernah mengirim tautan relatif
  const appOrigin = getAppOrigin();

  // Validasi ketat: tolak karakter CRLF (\r atau \n) untuk mencegah header injection
  const hasNoCrlf = !/[\r\n]/.test(from) && !/[\r\n]/.test(user) && !/[\r\n]/.test(apiKey);

  // Email pengirim harus bervalidasi format email standar
  const emailMatch = from.match(/^([^<]*)<([^>]+)>.*$/) || [null, '', from];
  const senderName = (emailMatch[1] || '').trim() || 'Singgah Sana';
  const pureEmail = (emailMatch[2] || from).trim();
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(pureEmail);

  const hasApiKey = Boolean(apiKey && apiKey.length >= 10);
  const hasSmtpCreds = Boolean(host && !isNaN(port) && port > 0 && user && pass);

  const isConfigured = Boolean(
    appOrigin &&
    hasNoCrlf &&
    from &&
    isEmailValid &&
    (hasApiKey || hasSmtpCreds)
  );

  const transportMode = hasApiKey ? 'https_api' : (hasSmtpCreds ? 'smtp' : 'none');

  return {
    isConfigured,
    transportMode,
    apiKey,
    host,
    port,
    user,
    pass,
    from,
    senderName,
    senderEmail: pureEmail,
    appOrigin,
  };
}

let transporterInstance = null;

function getMailTransporter() {
  const config = getMailConfig();
  if (!config.isConfigured) {
    return null;
  }

  if (!transporterInstance) {
    transporterInstance = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: false, // Port 587 menggunakan STARTTLS
      requireTLS: true,
      tls: {
        rejectUnauthorized: true, // Validasi sertifikat TLS tetap aktif
      },
      auth: {
        user: config.user,
        pass: config.pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      logger: false, // Jangan log detail SMTP atau data transmisi
      debug: false,
    });
  }

  return transporterInstance;
}

module.exports = {
  getAppOrigin,
  getMailConfig,
  getMailTransporter,
};
