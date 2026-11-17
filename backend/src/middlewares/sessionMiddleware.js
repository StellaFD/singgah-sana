const crypto = require('crypto');
const Session = require('../models/Session');
const { getJwtSecret } = require('../config/jwt');

const COOKIE_NAME = 'ss.sid';
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('base64url');
const csrfFor = token => crypto.createHmac('sha256', process.env.SESSION_SECRET || getJwtSecret()).update(token).digest('base64url');
const safeMethod = method => ['GET', 'HEAD', 'OPTIONS'].includes(method);

function readCookie(req) {
  const part = (req.headers.cookie || '').split(';').map(value => value.trim())
    .find(value => value.startsWith(`${COOKIE_NAME}=`));
  const value = part?.slice(COOKIE_NAME.length + 1);
  return value && /^[\w-]{43}$/.test(value) ? value : null;
}

function cookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' };
}

async function loadSession(req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const token = readCookie(req);
    if (token) req.sessionRecord = await Session.findOne({ token_hash: digest(token), expires_at: { $gt: new Date() } });
    next();
  } catch (error) { next(error); }
}

function validateCsrf(req, res, next) {
  const sessionFlow = Boolean(req.headers['x-csrf-token'] || readCookie(req));
  if (safeMethod(req.method) || !sessionFlow) return next();
  const origin = req.headers.origin;
  const isDevLocalhost = process.env.NODE_ENV !== 'production' && origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const origins = (process.env.APP_ORIGIN || '')
    .split(',')
    .map(o => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const normalizedOrigin = (origin || '').replace(/\/$/, '');
  const isAllowedOrigin = isDevLocalhost || (origins.length > 0 && origins.includes(normalizedOrigin)) || (process.env.NODE_ENV !== 'production' && normalizedOrigin === 'http://localhost:3000');
  const token = req.headers['x-csrf-token'];
  if (!isAllowedOrigin || typeof token !== 'string' ||
      !req.sessionRecord || !crypto.timingSafeEqual(Buffer.from(digest(token), 'hex'), Buffer.from(req.sessionRecord.csrf_hash, 'hex'))) {
    return res.status(403).json({ success: false, code: 'CSRF_INVALID', message: 'Sesi formulir tidak valid. Muat ulang lalu coba lagi.' });
  }
  next();
}

async function createSession(req, res, userId = null, tokenVersion = 0) {
  const token = randomToken();
  const csrfToken = csrfFor(token);
  const configured = Number(process.env.SESSION_TTL_SECONDS || 86400);
  const ttl = Number.isFinite(configured) && configured > 0 ? Math.min(configured, 604800) : 86400;
  const session = await Session.create({
    token_hash: digest(token),
    csrf_hash: digest(csrfToken),
    user_id: userId,
    token_version: tokenVersion,
    expires_at: new Date(Date.now() + ttl * 1000),
  });
  if (req.sessionRecord) await Session.deleteOne({ _id: req.sessionRecord._id });
  req.sessionRecord = session;
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: ttl * 1000 });
  return csrfToken;
}

async function getCsrf(req, res, next) {
  try {
    if (req.sessionRecord) {
      return res.json({ success: true, data: { csrf_token: csrfFor(readCookie(req)) } });
    }
    const fresh = await createSession(req, res);
    res.json({ success: true, data: { csrf_token: fresh } });
  } catch (error) { next(error); }
}

async function logout(req, res, next) {
  try {
    if (req.sessionRecord) await Session.deleteOne({ _id: req.sessionRecord._id });
    res.clearCookie(COOKIE_NAME, cookieOptions());
    res.json({ success: true, message: 'Anda sudah keluar.', data: null });
  } catch (error) { next(error); }
}

module.exports = { loadSession, validateCsrf, createSession, getCsrf, logout };
