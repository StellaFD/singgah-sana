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
  const origin = process.env.APP_ORIGIN;
  if (typeof origin === 'string' && origin.trim()) {
    try {
      const parsed = new URL(origin.trim());
      const isProd = process.env.NODE_ENV === 'production';
      // Di produksi wajib HTTPS, di dev/test boleh HTTP/HTTPS
      if (isProd && parsed.protocol !== 'https:') {
        return '';
      }
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return '';
      }
      // Dilarang membawa credential (user:pass), path kustom selain '/', query, atau fragment
      if (parsed.username || parsed.password) {
        return '';
      }
      if (parsed.pathname && parsed.pathname !== '/') {
        return '';
      }
      if (parsed.search || parsed.hash) {
        return '';
      }
      return parsed.origin;
    } catch {
      return '';
    }
  }
  return process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000';
}

function getMailConfig() {
  const host = (process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com').trim();
  const port = parseInt(process.env.BREVO_SMTP_PORT || '587', 10);
  const user = (process.env.BREVO_SMTP_USER || '').trim();
  const pass = (process.env.BREVO_SMTP_KEY || '').trim();
  const from = (process.env.MAIL_FROM || '').trim();

  // APP_ORIGIN wajib terverifikasi valid agar sistem tidak pernah mengirim tautan relatif
  const appOrigin = getAppOrigin();

  // Validasi MAIL_FROM ketat: tolak karakter CRLF (\r atau \n) untuk mencegah header injection
  const hasNoCrlf = !/[\r\n]/.test(from) && !/[\r\n]/.test(user);

  // Email pengirim harus bervalidasi format email standar
  const emailMatch = from.match(/^.*<([^>]+)>.*$/) || [null, from];
  const pureEmail = (emailMatch[1] || '').trim();
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(pureEmail);

  const isConfigured = Boolean(
    appOrigin &&
    hasNoCrlf &&
    host &&
    !isNaN(port) &&
    port > 0 &&
    user &&
    pass &&
    from &&
    isEmailValid
  );

  return {
    isConfigured,
    host,
    port,
    user,
    pass,
    from,
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
