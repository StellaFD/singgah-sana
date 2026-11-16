const submissionService = require('../services/submissionService');

const listSubmissions = async (req, res, next) => {
  try {
    const result = await submissionService.getAdminSubmissions(req.query);
    res.status(200).json({
      success: true,
      message: 'Antrean pengajuan berhasil diambil',
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

const getSubmissionDetail = async (req, res, next) => {
  try {
    const data = await submissionService.getAdminSubmissionDetail(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Detail pengajuan berhasil diambil',
      data,
    });
  } catch (error) {
    next(error);
  }
};

const decideSubmission = async (req, res, next) => {
  try {
    const data = await submissionService.decideSubmission(req.user, req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: `Pengajuan berhasil diputuskan dengan status ${data.status}`,
      data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listSubmissions,
  getSubmissionDetail,
  decideSubmission,
};
