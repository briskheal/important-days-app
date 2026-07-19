import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './UserProfileModal.module.css';

const UserProfileModal = ({ onClose }) => {
  const { user, login } = useAuth();
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
    pincode: user?.pincode || '',
    state: user?.state || '',
    email: user?.email || '',
    social: {
      xLink: user?.social?.xLink || '',
      xAuto: user?.social?.xAuto || false,
      fbLink: user?.social?.fbLink || '',
      fbAuto: user?.social?.fbAuto || false,
      igLink: user?.social?.igLink || '',
      igAuto: user?.social?.igAuto || false,
      liLink: user?.social?.liLink || '',
      liAuto: user?.social?.liAuto || false,
    }
  });

  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith('social.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        social: {
          ...prev.social,
          [field]: type === 'checkbox' ? checked : value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = () => {
    // Simulate saving to backend
    login({ ...user, ...formData });
    setMessage('✅ Profile updated successfully!');
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>👤 My Profile</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.grid}>
            <div className={styles.inputGroup}>
              <label>Full Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Your Name" />
            </div>
            <div className={styles.inputGroup}>
              <label>Mobile Number</label>
              <input type="text" name="phone" value={formData.phone} disabled className={styles.disabled} />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label>Address (Optional)</label>
            <textarea name="address" value={formData.address} onChange={handleChange} placeholder="House / Area / Street"></textarea>
          </div>

          <div className={styles.grid}>
            <div className={styles.inputGroup}>
              <label>Pincode</label>
              <input type="text" name="pincode" value={formData.pincode} onChange={handleChange} maxLength="6" placeholder="6-digit PIN" />
            </div>
            <div className={styles.inputGroup}>
              <label>State (Auto)</label>
              <input type="text" name="state" value={formData.state} disabled className={styles.disabled} placeholder="Auto-filled" />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label>Email ID</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="email@example.com" />
          </div>

          <div className={styles.socialSection}>
            <label className={styles.sectionLabel}>🔗 Social Profiles & Auto-Posting</label>
            
            <div className={styles.socialGrid}>
              <div className={styles.socialCol}>
                <div className={styles.socialRow}>
                  <span>𝕏</span>
                  <input type="text" name="social.xLink" value={formData.social.xLink} onChange={handleChange} placeholder="X Link" />
                </div>
                <label className={styles.autoToggle}>
                  <input type="checkbox" name="social.xAuto" checked={formData.social.xAuto} onChange={handleChange} />
                  Auto-post awareness days once daily.
                </label>

                <div className={styles.socialRow}>
                  <span>f</span>
                  <input type="text" name="social.fbLink" value={formData.social.fbLink} onChange={handleChange} placeholder="Facebook Link" />
                </div>
                <label className={styles.autoToggle}>
                  <input type="checkbox" name="social.fbAuto" checked={formData.social.fbAuto} onChange={handleChange} />
                  Share to Facebook timeline.
                </label>
              </div>

              <div className={styles.socialCol}>
                <div className={styles.socialRow}>
                  <span>in</span>
                  <input type="text" name="social.liLink" value={formData.social.liLink} onChange={handleChange} placeholder="LinkedIn Link" />
                </div>
                <label className={styles.autoToggle}>
                  <input type="checkbox" name="social.liAuto" checked={formData.social.liAuto} onChange={handleChange} />
                  Post to LinkedIn feed.
                </label>

                <div className={styles.socialRow}>
                  <span>📸</span>
                  <input type="text" name="social.igLink" value={formData.social.igLink} onChange={handleChange} placeholder="Instagram Link" />
                </div>
                <label className={styles.autoToggle}>
                  <input type="checkbox" name="social.igAuto" checked={formData.social.igAuto} onChange={handleChange} />
                  Instagram (Auto-post awareness days).
                </label>
              </div>
            </div>
          </div>

          {message && <p className={styles.message}>{message}</p>}

          <div className={styles.actions}>
            <button className={styles.saveBtn} onClick={handleSave}>💾 Save Changes</button>
            <button className={styles.resetBtn}>🔑 Reset Password</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
