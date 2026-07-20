import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import styles from './Register.module.css';

const Register = () => {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    ccode: '+91',
    phone: '',
    email: '',
    address: '',
    pincode: '',
    state: ''
  });

  const getApiUrl = (path) => {
    const isDev = window.location.hostname === 'localhost';
    return isDev ? `http://localhost:3000${path}` : path;
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const fullPhone = formData.ccode + ' ' + formData.phone;
    
    const payload = {
      name: formData.name,
      phone: fullPhone,
      email: formData.email,
      address: formData.address,
      pincode: formData.pincode,
      state: formData.state
    };
    
    try {
      const res = await fetch(getApiUrl('/api/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Registration successful! Server generated loginId and password.
        setSuccessData(data.user);
      } else {
        setError(data.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      setError('Connection error. Account could not be created.');
    } finally {
      setLoading(false);
    }
  };

  if (successData) {
    return (
      <div className={styles.container}>
        <div className={styles.authCard}>
          <div className={styles.successIcon}>🎉</div>
          <div className={styles.authHeader}>
            <h2 className={styles.authTitle}>Account Created!</h2>
            <p className={styles.authSubtitle}>Please save these credentials.</p>
          </div>
          
          <div className={styles.credentialsBox}>
            <div className={styles.credRow}>
              <span>Login ID:</span>
              <strong>{successData.loginId}</strong>
            </div>
            <div className={styles.credRow}>
              <span>Password:</span>
              <strong>{successData.password}</strong>
            </div>
          </div>
          
          <div className={styles.warningText}>
            ⚠️ You will need these to login. We have also sent them to your email/phone.
          </div>
          
          <button className={styles.btnPrimary} onClick={() => navigate('/login')}>
            Proceed to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <h2 className={styles.authTitle}>Create Account</h2>
          <p className={styles.authSubtitle}>Join Important Days today.</p>
        </div>
        
        {error && <div className={styles.errorBanner}>{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Full Name</label>
            <input 
              type="text" 
              name="name"
              className={styles.authInput} 
              placeholder="e.g. John Doe"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Phone Number</label>
            <div className={styles.inputRow}>
              <select 
                name="ccode"
                className={styles.authSelect} 
                value={formData.ccode}
                onChange={handleChange}
              >
                <option value="+91">IN (+91)</option>
                <option value="+1">US (+1)</option>
                <option value="+44">UK (+44)</option>
              </select>
              <input 
                type="tel" 
                name="phone"
                className={styles.authInput} 
                placeholder="10 digit number"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Email Address</label>
            <input 
              type="email" 
              name="email"
              className={styles.authInput} 
              placeholder="john@example.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Full Address</label>
            <input 
              type="text" 
              name="address"
              className={styles.authInput} 
              placeholder="Street, City"
              value={formData.address}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Pincode / Zip</label>
              <input 
                type="text" 
                name="pincode"
                className={styles.authInput} 
                placeholder="e.g. 110001"
                value={formData.pincode}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>State / Region</label>
              <input 
                type="text" 
                name="state"
                className={styles.authInput} 
                placeholder="e.g. Delhi"
                value={formData.state}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          
          <button type="submit" className={styles.btnPrimary} disabled={loading}>
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>
        
        <div className={styles.links}>
          <div className={styles.divider}>or</div>
          <Link to="/login" className={styles.btnSecondary}>
            Already have an account? Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
