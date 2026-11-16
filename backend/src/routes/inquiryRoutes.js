const express = require('express');
const router = express.Router();
const {
  sendInquiry,
  getMyInquiries,
  getOwnerInquiries,
  replyInquiry,
  getInquiryById,
  appendMessage,
} = require('../controllers/inquiryController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

router.use(protect);

router.post('/', authorize('pencari'), sendInquiry);
router.get('/my', authorize('pencari'), getMyInquiries);

router.get('/owner', authorize('pemilik'), getOwnerInquiries);
router.patch('/:id/reply', authorize('pemilik'), replyInquiry);

// Endpoint obrolan multi-turn / chat teks kanonikal
router.get('/:id', authorize('pencari', 'pemilik'), getInquiryById);
router.post('/:id/messages', authorize('pencari', 'pemilik'), appendMessage);

module.exports = router;
