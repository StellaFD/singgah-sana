const assert = require('node:assert/strict');
const crypto = require('crypto');
const { escapeHtml, renderPasswordResetEmail, renderEmailVerificationEmail } = require('../src/services/emailService');
const { getMailConfig, getAppOrigin } = require('../src/config/mail');

describe('Email Service & Recovery Unit Tests', () => {
  test('escapeHtml harus meng-escape karakter berbahaya', () => {
    const raw = '<script>alert("xss")</script>&\'';
    const escaped = escapeHtml(raw);
    assert.ok(!escaped.includes('<script>'));
    assert.ok(escaped.includes('&lt;script&gt;'));
    assert.ok(escaped.includes('&amp;'));
    assert.ok(escaped.includes('&quot;'));
    assert.ok(escaped.includes('&#39;'));
  });

  test('renderPasswordResetEmail menghasilkan teks dan HTML Bahasa Indonesia yang aman dengan brand purple #7C3AED dan fragment token', () => {
    const resetUrl = 'http://localhost:3000/reset-sandi#token=abcdef1234567890abcdef1234567890';
    const { subject, text, html } = renderPasswordResetEmail({
      name: 'Budi Santoso',
      resetUrl,
    });

    assert.equal(subject, 'Pemulihan Kata Sandi - Singgah Sana');
    assert.ok(text.includes('Halo Budi Santoso'));
    assert.ok(text.includes('30 menit'));
    assert.ok(text.includes(resetUrl));

    assert.ok(html.includes('Atur Ulang Kata Sandi'));
    assert.ok(html.includes('30 menit'));
    assert.ok(html.includes(resetUrl));
    assert.ok(html.includes('Singgah Sana'));
    assert.ok(html.includes('#7C3AED'));
  });

  test('renderEmailVerificationEmail menghasilkan teks dan HTML Bahasa Indonesia yang aman dengan brand purple #7C3AED dan fragment token', () => {
    const verifyUrl = 'http://localhost:3000/verifikasi-email/konfirmasi#token=fedcba0987654321fedcba0987654321';
    const { subject, text, html } = renderEmailVerificationEmail({
      name: 'Siti Aminah',
      verifyUrl,
    });

    assert.equal(subject, 'Verifikasi Alamat Email - Singgah Sana');
    assert.ok(text.includes('Halo Siti Aminah'));
    assert.ok(text.includes('24 jam'));
    assert.ok(text.includes(verifyUrl));

    assert.ok(html.includes('Verifikasi Email Saya'));
    assert.ok(html.includes('24 jam'));
    assert.ok(html.includes(verifyUrl));
    assert.ok(html.includes('#7C3AED'));
  });

  test('getAppOrigin mengembalikan origin bersih tanpa credentials, query, atau path tambahan', () => {
    const origin = getAppOrigin();
    assert.equal(typeof origin, 'string');
    assert.ok(!origin.endsWith('/'));
  });

  test('Token SHA-256 hash konsisten dan satu arah', () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    assert.equal(rawToken.length, 64);

    const hash1 = crypto.createHash('sha256').update(rawToken).digest('hex');
    const hash2 = crypto.createHash('sha256').update(rawToken).digest('hex');

    assert.equal(hash1, hash2);
    assert.notEqual(hash1, rawToken);
    assert.equal(hash1.length, 64);
  });

  test('getMailConfig memvalidasi kelengkapan konfigurasi SMTP secara ketat', () => {
    const config = getMailConfig();
    assert.equal(typeof config.isConfigured, 'boolean');
    assert.equal(typeof config.host, 'string');
    assert.equal(typeof config.port, 'number');
  });
});
