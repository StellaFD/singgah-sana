const auditService = require('../services/auditService');

const listAuditLogs = async (req, res, next) => {
  try {
    const result = await auditService.getAuditLogs(req.query);
    res.status(200).json({
      success: true,
      message: 'Riwayat audit admin berhasil diambil',
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

const getAuditLogDetail = async (req, res, next) => {
  try {
    const data = await auditService.getAuditLogById(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Detail log audit berhasil diambil',
      data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listAuditLogs,
  getAuditLogDetail,
};
