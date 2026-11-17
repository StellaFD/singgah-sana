const Kos = require('../models/Kos');
const User = require('../models/User');
const Pengajuan = require('../models/Pengajuan');
const { logAdminAction } = require('../services/auditService');
const { safeSearchTerm, parsePagination, csvCell } = require('../utils/helpers');
const { kirimNotifikasi } = require('../utils/notifikasi');
const { getPublicVisibilityQuery } = require('../utils/visibility');
const { toKosAdminDto } = require('../dto/submissionDto');

const ADMIN_KOS_STATUS_FILTERS = {
  status_verifikasi: ['draft', 'pending', 'revision', 'approved', 'rejected'],
  status_publikasi: ['active', 'archived'],
  status_moderasi: ['normal', 'suspended'],
};

const getAllKosAdmin = async (req, res, next) => {
  try {
    const { q, page, limit } = req.query;

    const filter = { deleted_at: null };
    // `status` dipertahankan untuk klien lama; `status_verifikasi` sesuai kontrak V1
    const statusVerifikasi = req.query.status_verifikasi || req.query.status;
    const requestedStatuses = {
      status_verifikasi: statusVerifikasi,
      status_publikasi: req.query.status_publikasi,
      status_moderasi: req.query.status_moderasi,
    };
    for (const [field, value] of Object.entries(requestedStatuses)) {
      if (!value) continue;
      const normalized = String(value).toLowerCase();
      if (!ADMIN_KOS_STATUS_FILTERS[field].includes(normalized)) {
        return res.status(422).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: `Filter ${field} tidak valid`,
        });
      }
      filter[field] = normalized;
    }
    if (q) {
      const term = safeSearchTerm(q);
      filter.$or = [
        { nama: { $regex: term, $options: 'i' } },
        { alamat: { $regex: term, $options: 'i' } },
        { area_kampus: { $regex: term, $options: 'i' } },
        { 'draft_konten.nama': { $regex: term, $options: 'i' } },
      ];
    }

    const { pageNum, limitNum } = parsePagination(page, limit, 15);

    const totalData = await Kos.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(totalData / limitNum));
    const currentPage = Math.min(pageNum, totalPages);
    const skip = (currentPage - 1) * limitNum;
    const dataKos = await Kos.find(filter)
      .populate('pemilik_id', 'nama email nomor_telepon role status email_verified version createdAt updatedAt alasan_suspend')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const activeSubmissions = await Pengajuan.find({
      kos_id: { $in: dataKos.map((kos) => kos._id) },
      is_active: true,
    });
    const submissionByKos = new Map(
      activeSubmissions.map((pengajuan) => [String(pengajuan.kos_id), pengajuan])
    );

    res.status(200).json({
      success: true,
      count: dataKos.length,
      pagination: {
        totalData,
        totalPages,
        currentPage,
        limit: limitNum,
      },
      data: dataKos.map((kos) => toKosAdminDto(kos, submissionByKos.get(String(kos._id)) || null)),
    });
  } catch (error) {
    next(error);
  }
};

const verifyKos = async (req, res, next) => {
  try {
    const { status_verifikasi, catatan_verifikasi, expected_version } = req.body;

    if (!['approved', 'rejected'].includes(status_verifikasi)) {
      return res.status(400).json({
        success: false,
        message: 'Status verifikasi harus bernilai "approved" atau "rejected"',
      });
    }
    if (status_verifikasi === 'rejected' && (typeof catatan_verifikasi !== 'string' || !catatan_verifikasi.trim())) {
      return res.status(422).json({ success: false, code: 'VALIDATION_ERROR', message: 'Alasan penolakan wajib diisi.' });
    }

    const kos = await Kos.findById(req.params.id);
    if (!kos) {
      return res.status(404).json({ success: false, message: 'Kos tidak ditemukan' });
    }

    // Periksa apakah listing memiliki pengajuan aktif kanonikal
    const pendingPengajuan = await Pengajuan.findOne({
      kos_id: kos._id,
      is_active: true,
      status: 'pending',
    });

    if (pendingPengajuan) {
      // Legacy route TIDAK boleh bypass expected_version atau transaksi/snapshot kanonikal.
      // Wajib mensyaratkan expected_version yang sesuai dengan pengajuan kanonikal atau ditolak 409 tanpa side-effect.
      if (typeof expected_version !== 'number' || expected_version !== pendingPengajuan.version) {
        return res.status(409).json({
          success: false,
          code: 'CONFLICT',
          message: 'Listing memiliki pengajuan aktif kanonikal. Verifikasi memerlukan expected_version pengajuan yang sesuai atau gunakan endpoint kanonikal PATCH /api/admin/pengajuan/:id/keputusan.',
        });
      }

      // Delegasikan ke canonical submissionService.decideSubmission untuk atomisitas transaksi, snapshot, dan audit
      const { decideSubmission } = require('../services/submissionService');
      const catatanFinal = catatan_verifikasi || (status_verifikasi === 'approved' ? 'Data telah diverifikasi dan disetujui untuk tayang publik.' : 'Pendaftaran ditolak karena informasi belum memenuhi kriteria.');
      const decisionResult = await decideSubmission(req.user, pendingPengajuan._id, {
        keputusan: status_verifikasi,
        catatan_verifikasi: catatanFinal,
        expected_version,
      });

      const updatedKos = await Kos.findById(kos._id);
      return res.status(200).json({
        success: true,
        message: `Status kos berhasil diubah menjadi '${status_verifikasi}'`,
        data: updatedKos,
        submission: decisionResult,
      });
    }

    // Jika belum ada pengajuan kanonikal aktif, tolak 409 dan arahkan pemilik untuk menarik listing ke draf
    return res.status(409).json({
      success: false,
      code: 'CONFLICT',
      message: 'Listing legacy berstatus pending belum memiliki dokumen pengajuan kanonikal. Pemilik listing harus menarik listing ke draf terlebih dahulu melalui POST /api/pemilik/kos/:id/tarik, melengkapi data dan foto, lalu mengajukan ulang.',
    });
  } catch (error) {
    next(error);
  }
};

const getDashboardStats = async (req, res, next) => {
  try {
    const kosStats = await Kos.aggregate([
      { $match: { deleted_at: null } },
      {
        $group: {
          _id: '$status_verifikasi',
          count: { $sum: 1 },
          totalKamarTersedia: { $sum: '$jumlah_kamar_tersedia' },
          totalKamarTotal: { $sum: '$jumlah_kamar_total' },
        },
      },
    ]);

    const userStats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]);

    const ringkasanKos = {
      totalKos: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
      totalKamarTersedia: 0,
      totalKamarTotal: 0,
    };

    kosStats.forEach((stat) => {
      ringkasanKos.totalKos += stat.count;
      ringkasanKos[stat._id] = stat.count;
      ringkasanKos.totalKamarTersedia += stat.totalKamarTersedia;
      ringkasanKos.totalKamarTotal += stat.totalKamarTotal;
    });

    const activeOwners = await User.find({
      $or: [{ status: 'active' }, { status: { $exists: false } }],
    }).select('_id').lean();
    const publicStats = await Kos.aggregate([
      { $match: { ...getPublicVisibilityQuery(), pemilik_id: { $in: activeOwners.map(user => user._id) } } },
      { $group: { _id: null, count: { $sum: 1 }, available: { $sum: '$jumlah_kamar_tersedia' }, total: { $sum: '$jumlah_kamar_total' } } },
    ]);
    ringkasanKos.approved = publicStats[0]?.count || 0;
    ringkasanKos.totalKamarTersedia = publicStats[0]?.available || 0;
    ringkasanKos.totalKamarTotal = publicStats[0]?.total || 0;
    ringkasanKos.pending = await Pengajuan.countDocuments({ is_active: true, status: 'pending' });

    const ringkasanUser = {
      totalUsers: 0,
      admin: 0,
      pemilik: 0,
      pencari: 0,
    };

    userStats.forEach((u) => {
      ringkasanUser.totalUsers += u.count;
      ringkasanUser[u._id] = u.count;
    });

    res.status(200).json({
      success: true,
      data: {
        kos: ringkasanKos,
        users: ringkasanUser,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const { role, q } = req.query;
    const filter = {};
    if (role) filter.role = String(role).toLowerCase();
    if (q) {
      const term = safeSearchTerm(q);
      filter.$or = [
        { nama: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } },
        { nomor_telepon: { $regex: term, $options: 'i' } },
      ];
    }

    const users = await User.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

const exportKosCSV = async (req, res, next) => {
  try {
    const dataKos = await Kos.find({ deleted_at: null }).populate('pemilik_id', 'nama email nomor_telepon');

    let csv = 'ID,Nama Kos,Tipe,Harga Per Bulan,Kamar Tersedia,Kamar Total,Status Verifikasi,Area Kampus,Alamat,Nama Pemilik,Kontak Pemilik\n';

    dataKos.forEach((k) => {
      const row = [
        k._id,
        k.nama,
        k.tipe,
        k.harga_per_bulan,
        k.jumlah_kamar_tersedia,
        k.jumlah_kamar_total,
        k.status_verifikasi,
        k.area_kampus,
        k.alamat,
        k.pemilik_id ? k.pemilik_id.nama : '',
        k.pemilik_id ? k.pemilik_id.nomor_telepon : '',
      ];
      csv += row.map(csvCell).join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="rekap_kos_singgah_sana.csv"');
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllKosAdmin,
  verifyKos,
  getDashboardStats,
  getAllUsers,
  exportKosCSV,
};
