import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Login.module.css';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState('login'); // 'login' | 'forgot' | 'reset'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Login State
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');

  // Forgot State
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotCcode, setForgotCcode] = useState('+91');
  
  // Reset State
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  const getApiUrl = (path) => {
    // Determine API URL based on environment
    const isDev = window.location.hostname === 'localhost';
    return isDev ? `http://localhost:3000${path}` : path;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginId || !password) return setError('Please fill all fields');
    
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(getApiUrl('/api/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId, password })
      });
      
      const data = await res.json();
      if (res.ok) {
        // Sync local users list for legacy offline support if needed
        const allUsers = JSON.parse(localStorage.getItem('importantDays_allUsers') || '[]');
        const existingIdx = allUsers.findIndex(u => u.loginId === data.user.loginId);
        if (existingIdx !== -1) allUsers[existingIdx] = data.user;
        else allUsers.push(data.user);
        localStorage.setItem('importantDays_allUsers', JSON.stringify(allUsers));
        
        login(data.user);
        navigate('/');
      } else {
        setError(data.message || 'Invalid ID or Password');
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    if (!forgotPhone) return setError('Please enter your phone number');
    
    setLoading(true);
    setError('');
    
    const fullPhone = forgotCcode + ' ' + forgotPhone;
    
    try {
      const res = await fetch(getApiUrl('/api/recover-account'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone })
      });
      
      const data = await res.json();
      if (res.ok) {
        setMaskedEmail(data.emailMasked);
        setView('reset');
        setSuccess('Security code sent to your email');
      } else {
        setError(data.message || 'Account not found.');
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (resetOtp.length !== 6) return setError('Please enter the 6-digit code');
    if (newPassword.length < 4) return setError('Password must be at least 4 characters');
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    const fullPhone = forgotCcode + ' ' + forgotPhone;
    
    try {
      const res = await fetch(getApiUrl('/api/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, otp: resetOtp, newPassword })
      });
      
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Password reset successful! Your LOGIN ID is: ${data.loginId}`);
        setLoginId(data.loginId);
        setPassword(newPassword);
        setView('login');
      } else {
        setError(data.message || 'Invalid or expired code.');
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.authCard}>
        <div className={styles.brandLogo}>
          <span role="img" aria-label="calendar">📅</span>
        </div>
        
        {view === 'login' && (
          <>
            <div className={styles.authHeader}>
              <h2 className={styles.authTitle}>Welcome Back</h2>
              <p className={styles.authSubtitle}>Login to manage your important days.</p>
            </div>
            
            {error && <div className={styles.errorBanner}>{error}</div>}
            {success && <div className={styles.successBanner}>{success}</div>}
            
            <form onSubmit={handleLogin}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Login ID</label>
                <input 
                  type="text" 
                  className={styles.authInput} 
                  placeholder="e.g. USER1234"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value.toUpperCase())}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Password</label>
                <input 
                  type="password" 
                  className={styles.authInput} 
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className={styles.btnPrimary} disabled={loading}>
                {loading ? 'Logging in...' : 'Sign In'}
              </button>
            </form>
            
            <div className={styles.links}>
              <button className={styles.btnLink} onClick={() => { setView('forgot'); setError(''); setSuccess(''); }}>
                Forgot Password?
              </button>
              <div className={styles.divider}>or</div>
              <Link to="/register" className={styles.btnSecondary}>
                Create New Account
              </Link>
            </div>
          </>
        )}

        {view === 'forgot' && (
          <>
            <div className={styles.authHeader}>
              <h2 className={styles.authTitle}>Recover Account</h2>
              <p className={styles.authSubtitle}>Enter your registered phone number.</p>
            </div>
            
            {error && <div className={styles.errorBanner}>{error}</div>}
            
            <form onSubmit={handleForgot}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Phone Number</label>
                <div className={styles.inputRow}>
                  <select 
                    className={styles.authSelect} 
                    value={forgotCcode}
                    onChange={(e) => setForgotCcode(e.target.value)}
                  >
                    <option value="+91">IN (+91)</option>
                    <option value="+1">US (+1)</option>
                    <option value="+44">UK (+44)</option>
                  </select>
                  <input 
                    type="tel" 
                    className={styles.authInput} 
                    placeholder="Enter 10 digit number"
                    value={forgotPhone}
                    onChange={(e) => setForgotPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button type="submit" className={styles.btnPrimary} disabled={loading}>
                {loading ? 'Sending Code...' : 'Get Recovery Code'}
              </button>
            </form>
            
            <button className={styles.btnLink} onClick={() => { setView('login'); setError(''); }}>
              ← Back to Login
            </button>
          </>
        )}

        {view === 'reset' && (
          <>
            <div className={styles.authHeader}>
              <h2 className={styles.authTitle}>Enter Security Code</h2>
              <p className={styles.authSubtitle}>Code sent to {maskedEmail}</p>
            </div>
            
            {error && <div className={styles.errorBanner}>{error}</div>}
            {success && <div className={styles.successBanner}>{success}</div>}
            
            <form onSubmit={handleReset}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>6-Digit OTP</label>
                <input 
                  type="text" 
                  className={styles.authInput} 
                  placeholder="000000"
                  maxLength="6"
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>New Password</label>
                <input 
                  type="password" 
                  className={styles.authInput} 
                  placeholder="Min 4 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className={styles.btnPrimary} disabled={loading}>
                {loading ? 'Verifying...' : 'Reset Password'}
              </button>
            </form>
            
            <button className={styles.btnLink} onClick={() => { setView('login'); setError(''); setSuccess(''); }}>
              ← Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;
