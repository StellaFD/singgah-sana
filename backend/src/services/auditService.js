const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const { toAuditDto } = require('../dto/submissionDto');
const { parsePagination } = require('../utils/helpers');

async function logAdminAction({
  admin,
  aksi,
  target_type,
  target_id,
  pengajuan_id = null,
  laporan_id = null,
  catatan = null,
  session = null,
}) {
  const doc = {
    admin,
    aksi,
    target_type,
    target_id,
    pengajuan_id,
    laporan_id,
    catatan: catatan ? String(catatan).trim() : null,
  };

  if (session) {
    const [created] = await AuditLog.create([doc], { session });
    return created;
  }

  return AuditLog.create(doc);
}

async function getAuditLogs(query = {}) {
  const { page, limit, aksi, target_type } = query;
  const filter = {};

  if (aksi) {
    filter.aksi = aksi;
  }
  if (target_type) {
    filter.target_type = target_type;
  }

  const { pageNum, limitNum } = parsePagination(page, limit, 12);
  const totalData = await AuditLog.countDocuments(filter);
  const totalPages = totalData > 0 ? Math.ceil(totalData / limitNum) : 1;
  const currentPage = totalData > 0 ? Math.min(Math.max(1, pageNum), totalPages) : 1;
  const clampedSkip = (currentPage - 1) * limitNum;

  const logs = await AuditLog.find(filter)
    .populate('admin', 'nama email role')
    .sort({ createdAt: -1 })
    .skip(clampedSkip)
    .limit(limitNum);

  return {
    data: logs.map((l) => toAuditDto(l)),
    pagination: {
      totalData,
      totalPages,
      currentPage,
      limit: limitNum,
    },
  };
}

async function getAuditLogById(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error('ID log audit tidak valid');
    err.statusCode = 400;
    err.code = 'MALFORMED_ID';
    throw err;
  }

  const log = await AuditLog.findById(id).populate('admin', 'nama email role');
  if (!log) {
    const err = new Error('Catatan audit tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }
  return toAuditDto(log);
}

module.exports = {
  logAdminAction,
  getAuditLogs,
  getAuditLogById,
};
