const express = require('express');
const multer = require('multer');
const router = express.Router();
const { uploadPhoto, deletePhoto } = require('../controllers/mediaController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const mediaRateLimit = require('../middlewares/mediaRateLimit');

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.use(protect);

router.post(
  '/',
  authorize('pemilik', 'admin'),
  mediaRateLimit,
  memoryUpload.single('file'),
  uploadPhoto
);

router.delete('/:id', authorize('pemilik', 'admin'), deletePhoto);

module.exports = router;
