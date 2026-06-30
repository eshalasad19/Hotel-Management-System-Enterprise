const express = require('express');
const router = express.Router();
const { protect, managerOrAdmin } = require('../Middleware/authMiddleware');
const {
  getAllGuestProfiles, getGuestProfile,
  updateGuestProfile, getCRMStats,
  redeemPoints, getLoyaltyInfo,
} = require('../Controllers/guestCRMController');

router.get('/',                    protect, managerOrAdmin, getAllGuestProfiles);
router.get('/stats',               protect, managerOrAdmin, getCRMStats);
router.get('/:userId',             protect, managerOrAdmin, getGuestProfile);
router.put('/:userId',             protect, managerOrAdmin, updateGuestProfile);
router.get('/:userId/loyalty',    protect, managerOrAdmin, getLoyaltyInfo);
router.post('/:userId/redeem',    protect, managerOrAdmin, redeemPoints);

module.exports = router;