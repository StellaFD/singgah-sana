const Inquiry = require('../models/Inquiry');
const Kos = require('../models/Kos');
const { isKosPubliclyVisible } = require('../utils/visibility');
const { kirimNotifikasi } = require('../utils/notifikasi');

const PESAN_INQUIRY_DUPLIKAT =
  'Anda masih memiliki pertanyaan yang menunggu balasan untuk kos ini. Mohon tunggu balasan pemilik sebelum mengirim pertanyaan baru';

const sendInquiry = async (req, res, next) => {
  try {
    const { kos_id, pesan } = req.body;

    if (!kos_id || !pesan) {
      return res.status(400).json({
        success: false,
        message: 'Mohon sertakan kos_id dan isi pesan pertanyaan',
      });
    }

    const kos = await Kos.findById(kos_id).populate('pemilik_id', 'status');
    if (!kos) {
      return res.status(404).json({ success: false, message: 'Kos tidak ditemukan' });
    }

    if (!isKosPubliclyVisible(kos)) {
      return res.status(400).json({
        success: false,
        message: 'Kos belum disetujui untuk publik sehingga belum dapat menerima pertanyaan',
      });
    }

    const existing = await Inquiry.findOne({
      pencari_id: req.user._id,
      kos_id,
      status: 'menunggu',
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: PESAN_INQUIRY_DUPLIKAT,
        data: { inquiry_id: existing._id },
      });
    }

    const inquiry = await Inquiry.create({
      pencari_id: req.user._id,
      pemilik_id: kos.pemilik_id?._id || kos.pemilik_id,
      kos_id,
      pesan,
      status: 'menunggu',
    });
    await kirimNotifikasi(kos.pemilik_id, { tipe: 'pesan_baru', judul: 'Pertanyaan baru', isi: pesan, tautan: '/pemilik/pesan' });

    res.status(201).json({
      success: true,
      message: 'Pesan pertanyaan berhasil dikirim ke pemilik kos',
      data: inquiry,
    });
  } catch (error) {
    // Dua request bersamaan bisa lolos findOne di atas; unique index di Inquiry.js menahannya
    if (error.code === 11000) {
      const existing = await Inquiry.findOne({
        pencari_id: req.user._id,
        kos_id: req.body.kos_id,
        status: 'menunggu',
      }).catch(() => null);
      return res.status(409).json({
        success: false,
        message: PESAN_INQUIRY_DUPLIKAT,
        data: existing ? { inquiry_id: existing._id } : undefined,
      });
    }
    next(error);
  }
};

const getMyInquiries = async (req, res, next) => {
  try {
    const semuaInquiry = await Inquiry.find({ pencari_id: req.user._id })
      .populate('kos_id', 'nama alamat foto harga_per_bulan tipe jumlah_kamar_tersedia')
      .populate('pemilik_id', 'nama nomor_telepon')
      .sort({ createdAt: -1 });

    // Jaring pengaman: lewati inquiry yang kos-nya sudah tidak ada
    const listInquiry = semuaInquiry.filter((inquiry) => inquiry.kos_id);

    res.status(200).json({
      success: true,
      count: listInquiry.length,
      data: listInquiry,
    });
  } catch (error) {
    next(error);
  }
};

const getOwnerInquiries = async (req, res, next) => {
  try {
    const semuaInquiry = await Inquiry.find({ pemilik_id: req.user._id })
      .populate('kos_id', 'nama alamat')
      .populate('pencari_id', 'nama nomor_telepon email')
      .sort({ createdAt: -1 });

    // Jaring pengaman: lewati inquiry yang kos-nya sudah tidak ada
    const listInquiry = semuaInquiry.filter((inquiry) => inquiry.kos_id);

    res.status(200).json({
      success: true,
      count: listInquiry.length,
      data: listInquiry,
    });
  } catch (error) {
    next(error);
  }
};

const replyInquiry = async (req, res, next) => {
  try {
    const { balasan } = req.body;

    if (!balasan) {
      return res.status(400).json({
        success: false,
        message: 'Mohon masukkan teks balasan',
      });
    }

    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Pesan tidak ditemukan' });
    }

    if (inquiry.pemilik_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak: Anda bukan pemilik yang berhak membalas pesan ini',
      });
    }

    // Keputusan P1: balasan yang sudah terkirim tidak bisa diubah
    if (inquiry.status === 'dibalas') {
      return res.status(400).json({
        success: false,
        message: 'Pesan ini sudah dibalas sehingga balasan tidak dapat diubah lagi',
      });
    }

    inquiry.balasan = balasan;
    inquiry.status = 'dibalas';
    const updated = await inquiry.save();
    await kirimNotifikasi(inquiry.pencari_id, { tipe: 'balasan_pesan', judul: 'Pemilik membalas pertanyaanmu', isi: balasan, tautan: `/pesan?c=${inquiry._id}` });

    res.status(200).json({
      success: true,
      message: 'Balasan pesan berhasil dikirim',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/inquiries/:id
 * Mengambil detail percakapan utuh beserta seluruh riwayat pesan multi-turn.
 * Otorisasi: hanya pencari atau pemilik kos dari percakapan ini yang diizinkan.
 */
const getInquiryById = async (req, res, next) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id)
      .populate('kos_id', 'nama alamat foto harga_per_bulan tipe jumlah_kamar_tersedia status_publikasi status_verifikasi status_moderasi')
      .populate('pencari_id', 'nama nomor_telepon email status')
      .populate('pemilik_id', 'nama nomor_telepon email status');

    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Percakapan tidak ditemukan' });
    }

    const userIdStr = req.user._id.toString();
    const isPencari = inquiry.pencari_id?._id?.toString() === userIdStr;
    const isPemilik = inquiry.pemilik_id?._id?.toString() === userIdStr;

    if (!isPencari && !isPemilik) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak: Anda bukan peserta dalam percakapan ini',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        _id: inquiry._id,
        status: inquiry.status,
        kos: inquiry.kos_id,
        pencari: inquiry.pencari_id,
        pemilik: inquiry.pemilik_id,
        riwayat_pesan: inquiry.riwayat_pesan,
        createdAt: inquiry.createdAt,
        updatedAt: inquiry.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/inquiries/:id/messages
 * Menambahkan pesan baru ke dalam percakapan (mendukung percakapan multi-turn bolak-balik).
 * Peserta yang berhak: Pencari atau Pemilik pada percakapan ini.
 */
const appendMessage = async (req, res, next) => {
  try {
    const { pesan } = req.body;
    const teksTrim = typeof pesan === 'string' ? pesan.trim() : '';

    if (!teksTrim) {
      return res.status(400).json({
        success: false,
        message: 'Teks pesan wajib diisi',
      });
    }

    if (teksTrim.length > 1000) {
      return res.status(422).json({
        success: false,
        message: 'Pesan maksimal 1000 karakter',
      });
    }

    const inquiry = await Inquiry.findById(req.params.id).populate('kos_id', 'status_verifikasi status_publikasi status_moderasi');
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Percakapan tidak ditemukan' });
    }

    const userIdStr = req.user._id.toString();
    const isPencari = inquiry.pencari_id.toString() === userIdStr;
    const isPemilik = inquiry.pemilik_id.toString() === userIdStr;

    if (!isPencari && !isPemilik) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak: Anda bukan peserta dalam percakapan ini',
      });
    }

    // Periksa status akun pengguna yang aktif mengirim
    if (req.user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Akun Anda sedang dibatasi (suspended), tidak dapat mengirim pesan',
      });
    }

    // Periksa status kos (jika kos diarsipkan atau tidak aktif, tolak pesan baru secara elegan)
    if (!inquiry.kos_id || inquiry.kos_id.status_publikasi === 'archived' || inquiry.kos_id.status_moderasi === 'banned') {
      return res.status(400).json({
        success: false,
        message: 'Listing kos ini sudah tidak aktif, pesan baru tidak dapat dikirim',
      });
    }

    const rolePengirim = isPencari ? 'pencari' : 'pemilik';
    const pesanBaru = {
      pengirim_id: req.user._id,
      pengirim_role: rolePengirim,
      teks: teksTrim,
    };

    inquiry.pesan_list.push(pesanBaru);
    // Jika ada pesan baru dari pencari setelah dibalas, ubah status percakapan agar pemilik melihat notifikasi
    if (rolePengirim === 'pencari') {
      inquiry.status = 'menunggu';
    } else {
      inquiry.status = 'dibalas';
    }

    await inquiry.save();

    // Kirim notifikasi ke lawan bicara
    const targetUserId = isPencari ? inquiry.pemilik_id : inquiry.pencari_id;
    const targetTautan = isPencari ? '/pemilik/pesan' : `/pesan?c=${inquiry._id}`;
    await kirimNotifikasi(targetUserId, {
      tipe: 'pesan_baru',
      judul: isPencari ? 'Pesan baru dari calon penghuni' : 'Balasan baru dari pemilik kos',
      isi: teksTrim,
      tautan: targetTautan,
    });

    const savedMessage = inquiry.pesan_list[inquiry.pesan_list.length - 1];

    res.status(201).json({
      success: true,
      message: 'Pesan berhasil dikirim',
      data: {
        _id: savedMessage._id,
        pengirim_id: savedMessage.pengirim_id,
        pengirim_role: savedMessage.pengirim_role,
        teks: savedMessage.teks,
        createdAt: savedMessage.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendInquiry,
  getMyInquiries,
  getOwnerInquiries,
  replyInquiry,
  getInquiryById,
  appendMessage,
};
