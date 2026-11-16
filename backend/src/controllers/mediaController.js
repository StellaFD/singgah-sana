const mediaService = require('../services/mediaService');

const uploadPhoto = async (req, res, next) => {
  try {
    const data = await mediaService.uploadMediaAsset({
      file: req.file,
      alt: req.body?.alt,
      userId: req.user._id,
    });
    res.status(201).json({
      success: true,
      message: 'Foto berhasil diunggah',
      data,
    });
  } catch (error) {
    next(error);
  }
};

const deletePhoto = async (req, res, next) => {
  try {
    await mediaService.deleteMediaAsset(req.user._id, req.params.id);
    res.status(200).json({
      success: true,
      message: 'Aset media berhasil dihapus',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadPhoto,
  deletePhoto,
};
