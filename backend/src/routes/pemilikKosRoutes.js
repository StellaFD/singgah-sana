const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/pemilikKosController');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');

router.use(protect);
router.use(authorize('pemilik'));

router.get('/', listOwnerKos);
router.post('/', createDraftKos);

router.get('/:id', getOwnerKosDetail);
router.patch('/:id', patchDraftKos);
router.delete('/:id', deleteOwnerKos);

router.post('/:id/ajukan', ajukanInitialKos);
router.post('/:id/tarik', tarikInitialKos);

router.patch('/:id/ketersediaan', updateKetersediaan);
router.patch('/:id/publikasi', updatePublikasi);

router.get('/:id/perubahan', getChangeSubmission);
router.put('/:id/perubahan', putChangeDraft);
router.delete('/:id/perubahan', deleteChangeDraft);
router.post('/:id/perubahan/ajukan', ajukanChangeDraft);
router.post('/:id/perubahan/tarik', tarikChangeDraft);

module.exports = router;
