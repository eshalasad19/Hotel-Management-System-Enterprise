import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import CustomPopup from './CustomPopup';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [popup, setPopup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // 2FA verify states
  const [show2FA, setShow2FA] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [tempToken, setTempToken] = useState('');

  // 2FA mandatory setup states
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [setupQR, setSetupQR] = useState('');
  const [setupSecret, setSetupSecret] = useState('');
  const [setupCode, setSetupCode] = useState('');

  // ── Normal Login ──
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { email, password });

      // Admin/Manager — 2FA setup mandatory
      if (res.data.requires2FASetup) {
        setTempToken(res.data.tempToken);
        const setupRes = await axios.post(`${API_URL}/auth/2fa/setup-with-token`, {
          tempToken: res.data.tempToken,
        });
        setSetupQR(setupRes.data.qrCode);
        setSetupSecret(setupRes.data.secret);
        setShow2FASetup(true);
        setLoading(false);
        return;
      }

      // 2FA already enabled — verify screen
      if (res.data.requires2FA) {
        setTempToken(res.data.tempToken);
        setShow2FA(true);
        setLoading(false);
        return;
      }

      // Normal login success
      const { token, refreshToken, user } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      redirectByRole(user.role);
    } catch (err) {
      setPopup({ type: 'error', message: err.response?.data?.message || 'Invalid email or password' });
    }
    setLoading(false);
  };

  // ── 2FA Verify (already enabled) ──
  const handle2FASubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/2fa/verify`, {
        tempToken,
        token: twoFACode,
      });
      const { token, refreshToken, user } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      redirectByRole(user.role);
    } catch (err) {
      setPopup({ type: 'error', message: err.response?.data?.message || 'Invalid 2FA code' });
    }
    setLoading(false);
  };

  // ── 2FA Mandatory Setup Complete ──
  const handle2FASetupComplete = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Enable karo
      await axios.post(`${API_URL}/auth/2fa/enable-with-token`, {
        tempToken,
        token: setupCode,
      });
      // Verify karke login karo
      const res = await axios.post(`${API_URL}/auth/2fa/verify`, {
        tempToken,
        token: setupCode,
      });
      const { token, refreshToken, user } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      redirectByRole(user.role);
    } catch (err) {
      setPopup({ type: 'error', message: err.response?.data?.message || 'Invalid code. Try again.' });
    }
    setLoading(false);
  };

  // ── Role based redirect ──
  const redirectByRole = (role) => {
    if (role === 'admin' || role === 'manager') navigate('/admin/dashboard');
    else if (role === 'receptionist') navigate('/admin/bookings');
    else if (role === 'housekeeping') navigate('/admin/housekeeping');
    else if (role === 'maintenance') navigate('/admin/maintenance');
    else navigate('/admin/dashboard');
  };

  return (
    <div className="auth-page-wrapper pt-5">
      <div className="auth-page-content">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-md-8 col-lg-6 col-xl-5">

              <div className="text-center mb-4 mt-4">
                <h3 className="fw-bold">🏨 Hotel Management System</h3>
                <p className="text-muted">Sign in to access your dashboard</p>
              </div>

              <div className="card mt-2">
                <div className="card-body p-4">

                  {popup && (
                    <CustomPopup
                      type={popup.type}
                      message={popup.message}
                      onClose={() => setPopup(null)}
                    />
                  )}

                  <div className="p-2">

                    {/* ── SCREEN 1: Mandatory 2FA Setup ── */}
                    {show2FASetup ? (
                      <form onSubmit={handle2FASetupComplete}>
                        <div className="text-center mb-3">
                          <h5>🔐 Setup Two-Factor Authentication</h5>
                          <p className="text-muted small">
                            Admin/Manager ke liye 2FA mandatory hai.<br />
                            Scan this QR code with Google Authenticator.
                          </p>
                        </div>
                        <div className="text-center mb-3">
                          {setupQR && <img src={setupQR} alt="QR Code" style={{ width: 180 }} />}
                          <p className="small mt-2 text-muted">
                            Or enter manually: <code>{setupSecret}</code>
                          </p>
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Enter the 6-digit code from the app</label>
                          <input
                            type="text"
                            className="form-control text-center"
                            placeholder="000000"
                            maxLength={6}
                            value={setupCode}
                            onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, ''))}
                            required
                            autoFocus
                            style={{ fontSize: '1.5rem', letterSpacing: '0.5rem' }}
                          />
                        </div>
                        <button
                          className="btn btn-success w-100"
                          type="submit"
                          disabled={loading || setupCode.length !== 6}
                        >
                          {loading ? 'Setting up...' : 'Verify & Login'}
                        </button>
                      </form>

                    ) : show2FA ? (
                      /* ── SCREEN 2: 2FA Verify ── */
                      <form onSubmit={handle2FASubmit}>
                        <div className="text-center mb-3">
                          <h5>Two-Factor Authentication</h5>
                          <p className="text-muted small">Enter the 6-digit code from your Google Authenticator app</p>
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Authentication Code</label>
                          <input
                            type="text"
                            className="form-control text-center"
                            placeholder="000000"
                            maxLength={6}
                            value={twoFACode}
                            onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ''))}
                            required
                            autoFocus
                            style={{ fontSize: '1.5rem', letterSpacing: '0.5rem' }}
                          />
                        </div>
                        <button
                          className="btn btn-success w-100"
                          type="submit"
                          disabled={loading || twoFACode.length !== 6}
                        >
                          {loading ? 'Verifying...' : 'Verify'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-link w-100 mt-2"
                          onClick={() => { setShow2FA(false); setTwoFACode(''); }}
                        >
                          Back to login
                        </button>
                      </form>

                    ) : (
                      /* ── SCREEN 3: Normal Login ── */
                      <form onSubmit={handleLogin}>
                        <div className="mb-3">
                          <label className="form-label">Email Address</label>
                          <input
                            type="email"
                            className="form-control"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Password</label>
                          <div className="position-relative auth-pass-inputgroup mb-3">
                            <input
                              type={showPass ? 'text' : 'password'}
                              className="form-control pe-5"
                              placeholder="Enter password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required
                            />
                            <button
                              className="btn btn-link position-absolute end-0 top-0 text-decoration-none text-muted"
                              type="button"
                              onClick={() => setShowPass(!showPass)}
                            >
                              <i className={`ri-${showPass ? 'eye-off' : 'eye'}-fill align-middle`}></i>
                            </button>
                          </div>
                        </div>
                        <div className="mt-4">
                          <button className="btn btn-success w-100" type="submit" disabled={loading}>
                            {loading ? 'Signing in...' : 'Sign In'}
                          </button>
                        </div>
                      </form>
                    )}

                  </div>
                </div>
              </div>

              <div className="mt-3 text-center">
                <p className="text-muted mb-0">&copy; 2024 Hotel Management System</p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;