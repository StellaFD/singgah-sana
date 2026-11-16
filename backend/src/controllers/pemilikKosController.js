const submissionService = require('../services/submissionService');

const listOwnerKos = async (req, res, next) => {
  try {
    const result = await submissionService.getOwnerKosList(req.user._id, req.query);
    res.status(200).json({
      success: true,
      message: 'Daftar listing pemilik berhasil diambil',
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

const createDraftKos = async (req, res, next) => {
  try {
    const data = await submissionService.createDraft(req.user._id, req.body);
    res.status(201).json({
      success: true,
      message: 'Draft listing berhasil dibuat',
      data,
    });
  } catch (error) {
    next(error);
  }
};

const getOwnerKosDetail = async (req, res, next) => {
  try {
    const data = await submissionService.getOwnerKosDetail(req.user._id, req.params.id);
    res.status(200).json({
      success: true,
      message: 'Detail listing pemilik berhasil diambil',
      data,
    });
  } catch (error) {
    next(error);
  }
};

const patchDraftKos = async (req, res, next) => {
  try {
    const data = await submissionService.updateDraft(req.user._id, req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Draft listing berhasil diperbarui',
      data,
    });
  } catch (error) {
    next(error);
  }
};

const deleteOwnerKos = async (req, res, next) => {
  try {
    const expectedVersion = req.body?.expected_version;
    await submissionService.softDeleteKos(req.user._id, req.params.id, expectedVersion);
    res.status(200).json({
      success: true,
      message: 'Listing berhasil dihapus',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

const ajukanInitialKos = async (req, res, next) => {
  try {
    const expectedVersion = req.body?.expected_version;
    const data = await submissionService.submitInitialKos(req.user._id, req.params.id, expectedVersion);
    res.status(200).json({
      success: true,
      message: 'Pengajuan listing awal berhasil dikirim dan menunggu verifikasi admin',
      data,
    });
  } catch (error) {
    next(error);
  }
};

const tarikInitialKos = async (req, res, next) => {
  try {
    const expectedVersion = req.body?.expected_version;
    const data = await submissionService.withdrawInitialKos(req.user._id, req.params.id, expectedVersion);
    res.status(200).json({
      success: true,
      message: 'Pengajuan awal berhasil ditarik kembali ke status draft',
      data,
    });
  } catch (error) {
    next(error);
  }
};

const updateKetersediaan = async (req, res, next) => {
  try {
    const { jumlah_kamar_tersedia, expected_version } = req.body || {};
    const data = await submissionService.updateAvailability(
      req.user._id,
      req.params.id,
      jumlah_kamar_tersedia,
      expected_version
    );
    res.status(200).json({
      success: true,
      message: 'Ketersediaan kamar berhasil diperbarui',
      data,
    });
  } catch (error) {
    next(error);
  }
};

const updatePublikasi = async (req, res, next) => {
  try {
    const { status_publikasi, expected_version } = req.body || {};
    const data = await submissionService.updatePublication(
      req.user._id,
      req.params.id,
      status_publikasi,
      expected_version
    );
    res.status(200).json({
      success: true,
      message: `Status publikasi berhasil diubah menjadi ${status_publikasi}`,
      data,
    });
  } catch (error) {
    next(error);
  }
};

const getChangeSubmission = async (req, res, next) => {
  try {
    const data = await submissionService.getChangeSubmission(req.user._id, req.params.id);
    res.status(200).json({
      success: true,
      message: 'Detail pengajuan perubahan berhasil diambil',
      data,
    });
  } catch (error) {
    next(error);
  }
};

const putChangeDraft = async (req, res, next) => {
  try {
    const data = await submissionService.upsertChangeDraft(req.user._id, req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Draft perubahan berhasil disimpan',
      data,
    });
  } catch (error) {
    next(error);
  }
};

const deleteChangeDraft = async (req, res, next) => {
  try {
    const expectedVersion = req.body?.expected_version;
    await submissionService.discardChangeDraft(req.user._id, req.params.id, expectedVersion);
    res.status(200).json({
      success: true,
      message: 'Draft perubahan berhasil dibuang',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

const ajukanChangeDraft = async (req, res, next) => {
  try {
    const expectedVersion = req.body?.expected_version;
    const data = await submissionService.submitChangeDraft(req.user._id, req.params.id, expectedVersion);
    res.status(200).json({
      success: true,
      message: 'Pengajuan perubahan berhasil dikirim dan menunggu verifikasi admin',
      data,
    });
  } catch (error) {
    next(error);
  }
};

const tarikChangeDraft = async (req, res, next) => {
  try {
    const expectedVersion = req.body?.expected_version;
    const data = await submissionService.withdrawChangeDraft(req.user._id, req.params.id, expectedVersion);
    res.status(200).json({
      success: true,
      message: 'Pengajuan perubahan berhasil ditarik kembali ke status draft',
      data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listOwnerKos,
  createDraftKos,
  getOwnerKosDetail,
  patchDraftKos,
  deleteOwnerKos,
  ajukanInitialKos,
  tarikInitialKos,
  updateKetersediaan,
  updatePublikasi,
  getChangeSubmission,
  putChangeDraft,
  deleteChangeDraft,
  ajukanChangeDraft,
  tarikChangeDraft,
};
