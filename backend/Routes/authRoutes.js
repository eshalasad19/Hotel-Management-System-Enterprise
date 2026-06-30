const express = require('express');
const router = express.Router();
const { 
  register, login, getProfile, getAllUsers, 
  updateUser, deleteUser, createWalkInGuest,
  updateOwnProfile, changePassword,
  refreshAccessToken, logout,
  setup2FA, enable2FA, verify2FA, disable2FA,
  setup2FAWithToken, enable2FAWithToken
} = require('../Controllers/authController');
const { protect, adminOnly } = require('../Middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.get('/profile', protect, getProfile);

router.put('/profile/update', protect, updateOwnProfile);
router.put('/profile/change-password', protect, changePassword);

router.get('/users', protect, adminOnly, getAllUsers);
router.put('/users/:id', protect, adminOnly, updateUser);
router.delete('/users/:id', protect, adminOnly, deleteUser);

router.post('/walkin-guest', protect, adminOnly, createWalkInGuest);

router.post('/refresh-token', refreshAccessToken);
router.post('/logout', protect, logout);

router.post('/2fa/setup', protect, setup2FA);
router.post('/2fa/enable', protect, enable2FA);
router.post('/2fa/verify', verify2FA);
router.post('/2fa/disable', protect, disable2FA);
router.post('/2fa/setup-with-token', setup2FAWithToken);
router.post('/2fa/enable-with-token', enable2FAWithToken);

module.exports = router;