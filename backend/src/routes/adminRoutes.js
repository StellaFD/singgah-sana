const express = require('express');
const router = express.Router();
const {
  getAllKosAdmin,
  verifyKos,
  getDashboardStats,
  getAllUsers,
  exportKosCSV,
} = require('../controllers/adminController');
const {
  listSubmissions,
  getSubmissionDetail,
  decideSubmission,
} = require('../controllers/adminPengajuanController');
const {
  listAuditLogs,
  getAuditLogDetail,
} = require('../controllers/adminAuditController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

router.use(protect);
router.use(authorize('admin'));

// Rute pengelolaan kos admin
router.get('/kos', getAllKosAdmin);
router.patch('/kos/:id/verifikasi', verifyKos);
router.get('/stats', getDashboardStats);
router.get('/users', getAllUsers);
router.get('/export/kos', exportKosCSV);

// Rute antrean & keputusan pengajuan listing
router.get('/pengajuan', listSubmissions);
router.get('/pengajuan/:id', getSubmissionDetail);
router.patch('/pengajuan/:id/keputusan', decideSubmission);

// Rute audit logs tindakan admin
router.get('/audit-logs', listAuditLogs);
router.get('/audit-logs/:id', getAuditLogDetail);

module.exports = router;
