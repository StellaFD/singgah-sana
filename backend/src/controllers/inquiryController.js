const Inquiry = require('../models/Inquiry');
const Kos = require('../models/Kos');
const { isKosPubliclyVisible } = require('../utils/visibility');
const { kirimNotifikasi } = require('../utils/notifikasi');
const Notifikasi = require('../models/Notifikasi');

const PESAN_INQUIRY_DUPLIKAT =
  'Anda masih memiliki pertanyaan yang menunggu balasan untuk kos ini. Mohon tunggu balasan pemilik sebelum mengirim pertanyaan baru';

/**
 * Helper kebijakan bersama untuk memeriksa apakah percakapan aktif dan mengizinkan pesan baru.
 * Listing harus: approved, active, normal, belum dihapus (deleted_at null).
 * Pemilik harus: aktif (status !== 'suspended').
 * Jika listing archived atau suspended/banned, percakapan menjadi read-only.
 */
function evaluateMessagingPolicy(kosDoc, senderUser) {
  if (!senderUser || senderUser.status === 'suspended') {
    return {
      allowed: false,
      status: 403,
      message: 'Akun Anda sedang dibatasi (suspended), tidak dapat mengirim pesan',
    };
  }

  if (!kosDoc || kosDoc.deleted_at) {
    return {
      allowed: false,
      status: 400,
      message: 'Listing kos ini sudah dihapus, pesan baru tidak dapat dikirim',
    };
  }

  if (kosDoc.status_verifikasi !== 'approved') {
    return {
      allowed: false,
      status: 400,
      message: 'Kos belum disetujui untuk publik sehingga belum dapat menerima pesan',
    };
  }

  if (!isKosPubliclyVisible(kosDoc)) {
    return {
      allowed: false,
      status: 400,
      message: 'Listing kos ini tidak tersedia untuk publik atau akun pemilik sedang dibatasi',
    };
  }

  return { allowed: true };
}

// Sederhana in-memory sliding window rate limiter untuk chat:
// Maksimal 20 pesan per 60 detik per pengguna
const userMessageRateMap = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 20;

  const key = String(userId);
  const userTimestamps = userMessageRateMap.get(key) || [];
  const validTimestamps = userTimestamps.filter((ts) => now - ts < windowMs);

  if (validTimestamps.length >= maxRequests) {
    return false;
  }

  validTimestamps.push(now);
  userMessageRateMap.set(key, validTimestamps);
  return true;
}

const sendInquiry = async (req, res, next) => {
  try {
    const { kos_id, pesan, client_msg_id } = req.body;

    if (!kos_id || !pesan) {
      return res.status(400).json({
        success: false,
        message: 'Mohon sertakan kos_id dan isi pesan pertanyaan',
      });
    }

    const teksTrim = typeof pesan === 'string' ? pesan.trim() : '';
    if (!teksTrim) {
      return res.status(422).json({
        success: false,
        message: 'Pesan pertanyaan tidak boleh hanya berupa spasi',
      });
    }

    if (teksTrim.length > 1000) {
      return res.status(422).json({
        success: false,
        message: 'Pesan pertanyaan maksimal 1000 karakter',
      });
    }

    const clientMsgId =
      typeof client_msg_id === 'string' && client_msg_id.trim()
        ? client_msg_id.trim().slice(0, 64)
        : null;

    const kos = await Kos.findById(kos_id).populate('pemilik_id', 'status');
    if (!kos) {
      return res.status(404).json({ success: false, message: 'Kos tidak ditemukan' });
    }

    const policy = evaluateMessagingPolicy(kos, req.user);
    if (!policy.allowed) {
      return res.status(policy.status).json({ success: false, message: policy.message });
    }

    // Rate limiting pengiriman pesan
    if (!checkRateLimit(req.user._id)) {
      return res.status(429).json({
        success: false,
        message: 'Pengiriman pesan terlalu cepat. Mohon tunggu sebentar.',
      });
    }

    // Cek apakah pencari memiliki pertanyaan yang masih 'menunggu' balasan pada kos ini
    const existingWaiting = await Inquiry.findOne({
      pencari_id: req.user._id,
      kos_id,
      status: 'menunggu',
    });

    if (existingWaiting) {
      // Idempotensi berbasis client_msg_id
      if (clientMsgId) {
        if (existingWaiting.client_msg_id === clientMsgId) {
          return res.status(200).json({
            success: true,
            message: 'Pesan sudah terkirim (idempotent)',
            data: existingWaiting,
          });
        }
        const alreadyExists = existingWaiting.pesan_list?.find(
          (m) => m.client_msg_id === clientMsgId
        );
        if (alreadyExists) {
          return res.status(200).json({
            success: true,
            message: 'Pesan sudah terkirim (idempotent)',
            data: existingWaiting,
          });
        }
      }

      return res.status(409).json({
        success: false,
        message: 'Anda masih memiliki pertanyaan yang menunggu balasan pemilik pada kos ini',
        data: {
          inquiry_id: existingWaiting._id,
        },
      });
    }

    // Buat inquiry baru (status: 'menunggu')
    const inquiry = await Inquiry.create({
      pencari_id: req.user._id,
      pemilik_id: kos.pemilik_id?._id || kos.pemilik_id,
      kos_id,
      pesan: teksTrim,
      client_msg_id: clientMsgId,
      status: 'menunggu',
    });
    await kirimNotifikasi(kos.pemilik_id, {
      tipe: 'pesan_baru',
      judul: 'Pertanyaan baru',
      isi: teksTrim,
      tautan: `/pemilik/pesan?id=${inquiry._id}`,
    });

    res.status(201).json({
      success: true,
      message: 'Pesan pertanyaan berhasil dikirim ke pemilik kos',
      data: inquiry,
    });
  } catch (error) {
    if (error && error.code === 11000) {
      const existing = await Inquiry.findOne({
        pencari_id: req.user._id,
        kos_id: req.body.kos_id,
        status: 'menunggu',
      });
      if (existing) {
        const clientMsgId = typeof req.body.client_msg_id === 'string' ? req.body.client_msg_id.trim() : null;
        if (clientMsgId && (existing.client_msg_id === clientMsgId || existing.pesan_list?.some(m => m.client_msg_id === clientMsgId))) {
          return res.status(200).json({
            success: true,
            message: 'Pesan sudah terkirim (idempotent)',
            data: existing,
          });
        }
        return res.status(409).json({
          success: false,
          message: 'Anda masih memiliki pertanyaan yang menunggu balasan pemilik pada kos ini',
          data: {
            inquiry_id: existing._id,
          },
        });
      }
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
      .populate('kos_id', 'nama alamat foto')
      .populate('pencari_id', 'nama nomor_telepon email')
      .sort({ updatedAt: -1, createdAt: -1 });

    // Jaring pengaman: lewati inquiry yang kos-nya sudah tidak ada
    const listInquiry = semuaInquiry
      .filter((inquiry) => inquiry.kos_id)
      .map((item) => {
        const obj = item.toObject({ virtuals: true });
        // Sediakan cuplikan dan waktu pesan paling mutakhir dari riwayat
        let cuplikan = obj.balasan || obj.pesan;
        let waktu = obj.updatedAt;
        if (Array.isArray(obj.pesan_list) && obj.pesan_list.length > 0) {
          const lastMsg = obj.pesan_list[obj.pesan_list.length - 1];
          cuplikan = lastMsg.teks;
          waktu = lastMsg.createdAt || obj.updatedAt;
        }
        return {
          ...obj,
          cuplikan,
          waktu_terbaru: waktu,
        };
      });

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

    const teksTrim = typeof balasan === 'string' ? balasan.trim() : '';
    if (!teksTrim) {
      return res.status(400).json({
        success: false,
        message: 'Balasan tidak boleh hanya berupa spasi',
      });
    }

    if (teksTrim.length > 1000) {
      return res.status(422).json({
        success: false,
        message: 'Balasan maksimal 1000 karakter',
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

    // Periksa status akun dan kos melalui helper kebijakan bersama
    const kos = await Kos.findById(inquiry.kos_id).populate('pemilik_id', 'status');
    const policy = evaluateMessagingPolicy(kos, req.user);
    if (!policy.allowed) {
      return res.status(policy.status).json({ success: false, message: policy.message });
    }

    // Keputusan P1: balasan yang sudah terkirim tidak bisa diubah
    if (inquiry.status === 'dibalas') {
      return res.status(400).json({
        success: false,
        message: 'Pesan ini sudah dibalas sehingga balasan tidak dapat diubah lagi',
      });
    }

    inquiry.balasan = teksTrim;
    inquiry.balasan_at = new Date();
    inquiry.status = 'dibalas';
    const updated = await inquiry.save();
    await kirimNotifikasi(inquiry.pencari_id, { tipe: 'balasan_pesan', judul: 'Pemilik membalas pertanyaanmu', isi: teksTrim, tautan: `/pesan?c=${inquiry._id}` });

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

    // Membuka percakapan = membaca notifikasinya (hanya halaman pertama, bukan saat memuat pesan lama)
    if (!req.query.before && !req.query.cursor) {
      const tautanPercakapan = isPencari
        ? [`/pesan?c=${inquiry._id}`]
        : [`/pemilik/pesan?id=${inquiry._id}`];
      await Notifikasi.updateMany(
        { user_id: req.user._id, dibaca: false, tautan: { $in: tautanPercakapan } },
        { $set: { dibaca: true } }
      ).catch((error) => {
        console.error(`[Notifikasi] Gagal menandai notifikasi percakapan: ${error.message}`);
      });
    }

    // Dukungan batas dan pagination cursor riwayat pesan (default 50 pesan terakhir)
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 50));
    const fullHistory = inquiry.riwayat_pesan || [];
    const totalPesan = fullHistory.length;

    let endIndex = totalPesan;
    const beforeId = req.query.before || req.query.cursor;
    if (beforeId) {
      const idx = fullHistory.findIndex((m) => String(m._id) === String(beforeId));
      if (idx !== -1) {
        endIndex = idx;
      }
    }

    const startIndex = Math.max(0, endIndex - limit);
    const pagedHistory = fullHistory.slice(startIndex, endIndex);
    const hasMore = startIndex > 0;
    const oldestCursor = pagedHistory.length > 0 ? pagedHistory[0]._id : null;

    res.status(200).json({
      success: true,
      data: {
        _id: inquiry._id,
        status: inquiry.status,
        kos: inquiry.kos_id,
        pencari: inquiry.pencari_id,
        pemilik: inquiry.pemilik_id,
        riwayat_pesan: pagedHistory,
        pagination: {
          total_pesan: totalPesan,
          limit,
          has_more: hasMore,
          oldest_cursor: oldestCursor,
        },
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
    const { pesan, teks, balasan, client_msg_id } = req.body;
    const teksInput = pesan ?? teks ?? balasan ?? '';
    const teksTrim = typeof teksInput === 'string' ? teksInput.trim() : '';

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

    const inquiry = await Inquiry.findById(req.params.id);
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

    // Evaluasi kebijakan pengiriman pesan bersama
    const kos = await Kos.findById(inquiry.kos_id).populate('pemilik_id', 'status');
    const policy = evaluateMessagingPolicy(kos, req.user);
    if (!policy.allowed) {
      return res.status(policy.status).json({ success: false, message: policy.message });
    }

    // Rate limiting pengiriman pesan
    if (!checkRateLimit(req.user._id)) {
      return res.status(429).json({
        success: false,
        message: 'Pengiriman pesan terlalu cepat. Mohon tunggu sebentar.',
      });
    }

    const clientMsgId =
      typeof client_msg_id === 'string' && client_msg_id.trim()
        ? client_msg_id.trim().slice(0, 64)
        : null;

    const rolePengirim = isPencari ? 'pencari' : 'pemilik';
    const pesanBaru = {
      pengirim_id: req.user._id,
      pengirim_role: rolePengirim,
      teks: teksTrim,
      client_msg_id: clientMsgId,
    };

    const targetUserId = isPencari ? inquiry.pemilik_id : inquiry.pencari_id;
    const targetTautan = isPencari ? `/pemilik/pesan?id=${inquiry._id}` : `/pesan?c=${inquiry._id}`;

    if (clientMsgId) {
      // 1. Cek idempotensi pada dokumen saat ini
      const existingMessage = inquiry.pesan_list?.find(
        (m) => m.client_msg_id === clientMsgId
      );
      if (existingMessage) {
        return res.status(200).json({
          success: true,
          message: 'Pesan sudah tersimpan sebelumnya (idempotent)',
          data: {
            _id: existingMessage._id,
            pengirim_id: existingMessage.pengirim_id,
            pengirim_role: existingMessage.pengirim_role,
            teks: existingMessage.teks,
            client_msg_id: existingMessage.client_msg_id,
            createdAt: existingMessage.createdAt,
          },
        });
      }

      // 2. Pembaruan atomik: cegah balapan request bersamaan dengan syarat pesan_list.client_msg_id belum ada
      const updatedInquiry = await Inquiry.findOneAndUpdate(
        {
          _id: inquiry._id,
          'pesan_list.client_msg_id': { $ne: clientMsgId },
        },
        {
          $push: { pesan_list: pesanBaru },
          $set: {
            status: rolePengirim === 'pencari' ? 'menunggu' : 'dibalas',
          },
        },
        { new: true }
      );

      if (!updatedInquiry) {
        // Balapan konkurensi: request kembar telah memasukkan client_msg_id tersebut
        const current = await Inquiry.findById(inquiry._id);
        const dup = current?.pesan_list?.find(
          (m) => m.client_msg_id === clientMsgId
        );
        if (dup) {
          return res.status(200).json({
            success: true,
            message: 'Pesan sudah tersimpan sebelumnya (idempotent)',
            data: {
              _id: dup._id,
              pengirim_id: dup.pengirim_id,
              pengirim_role: dup.pengirim_role,
              teks: dup.teks,
              client_msg_id: dup.client_msg_id,
              createdAt: dup.createdAt,
            },
          });
        }
        // Percakapan hilang di tengah proses; jangan lanjut membaca updatedInquiry (null)
        return res.status(409).json({
          success: false,
          message: 'Percakapan berubah saat pesan dikirim. Muat ulang lalu coba lagi.',
        });
      }

      await kirimNotifikasi(targetUserId, {
        tipe: 'pesan_baru',
        judul: isPencari ? 'Pesan baru dari calon penghuni' : 'Balasan baru dari pemilik kos',
        isi: teksTrim,
        tautan: targetTautan,
      });

      const savedMessage =
        updatedInquiry.pesan_list[updatedInquiry.pesan_list.length - 1];

      return res.status(201).json({
        success: true,
        message: 'Pesan berhasil dikirim',
        data: {
          _id: savedMessage._id,
          pengirim_id: savedMessage.pengirim_id,
          pengirim_role: savedMessage.pengirim_role,
          teks: savedMessage.teks,
          client_msg_id: savedMessage.client_msg_id,
          createdAt: savedMessage.createdAt,
        },
      });
    }

    inquiry.pesan_list.push(pesanBaru);
    inquiry.status = rolePengirim === 'pencari' ? 'menunggu' : 'dibalas';
    await inquiry.save();

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
        client_msg_id: savedMessage.client_msg_id,
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
