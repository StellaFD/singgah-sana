const express = require('express');
const router = express.Router();
const {
  getAllKosPublic,
  getKosMapPublic,
  getKosById,
  createKos,
  getMyKos,
  updateKos,
  deleteKos,
} = require('../controllers/kosController');
const { protect, optionalProtect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

router.get('/', getAllKosPublic);
router.get('/map', getKosMapPublic);
router.get('/owner/my-kos', protect, authorize('pemilik'), getMyKos);
router.get('/:id', optionalProtect, getKosById);
router.post('/', protect, authorize('pemilik'), createKos);
router.put('/:id', protect, authorize('pemilik', 'admin'), updateKos);
router.delete('/:id', protect, authorize('pemilik', 'admin'), deleteKos);

module.exports = router;
