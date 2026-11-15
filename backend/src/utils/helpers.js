/**
 * Utilitas bersama untuk keamanan input dan paginasi.
 */

// Escape karakter khusus regex agar input pengguna diperlakukan sebagai teks biasa
// (mencegah regex injection / ReDoS pada query $regex).
const escapeRegex = (str = '') => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Membatasi panjang kata kunci pencarian.
const safeSearchTerm = (str, maxLen = 100) => escapeRegex(String(str).trim().slice(0, maxLen));

// Paginasi aman: nilai non-numerik jatuh ke default, limit dibatasi maksimum.
const parsePagination = (page, limit, defaultLimit = 10, maxLimit = 100) => {
  let pageNum = parseInt(page, 10);
  let limitNum = parseInt(limit, 10);
  if (!Number.isFinite(pageNum) || pageNum < 1) pageNum = 1;
  if (!Number.isFinite(limitNum) || limitNum < 1) limitNum = defaultLimit;
  if (limitNum > maxLimit) limitNum = maxLimit;
  return { pageNum, limitNum, skip: (pageNum - 1) * limitNum };
};

// Memeriksa dan mem-parse nilai numerik skalar finite ketat.
// Menolak: undefined, null, boolean, array, object, string kosong/whitespace, NaN, Infinity, -Infinity.
const parseStrictNumber = (val) => {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    if (!/^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(trimmed)) {
      return null;
    }
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

// Memeriksa dan mem-parse koordinat geografis ketat dalam rentang min dan max.
// Menerima angka 0 dan numeric string non-blank dalam rentang [min, max].
// Menolak: null, boolean, array, object, whitespace, NaN, Infinity, dan angka di luar rentang.
const parseStrictCoordinate = (val, min, max) => {
  const n = parseStrictNumber(val);
  if (n === null) return null;
  return n >= min && n <= max ? n : null;
};

// Mengubah nilai menjadi angka, atau undefined jika tidak valid.
const toNumberOrUndefined = (val) => {
  if (val === undefined || val === null || val === '') return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
};

// Sel CSV yang aman: selalu dikutip, tanda kutip di-escape, dan diberi awalan
// apostrof bila diawali karakter formula (=, +, -, @, tab, CR) untuk mencegah CSV injection.
const csvCell = (val) => {
  let s = val === undefined || val === null ? '' : String(val);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

module.exports = {
  escapeRegex,
  safeSearchTerm,
  parsePagination,
  parseStrictNumber,
  parseStrictCoordinate,
  toNumberOrUndefined,
  csvCell,
};
