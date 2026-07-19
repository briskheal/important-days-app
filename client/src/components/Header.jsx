import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Header.module.css';

const Header = ({ onOpenProfile, onOpenSubscribe }) => {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.logo} onClick={() => navigate('/')}>
          <div className={styles.logoIcon}>
            <span role="img" aria-label="icon">📅</span>
          </div>
          <div className={styles.logoText}>
            <h1>Important Days</h1>
            <p>Global & India Celebrations</p>
          </div>
        </div>

        <div className={styles.actions}>
          {user ? (
            <>
              <button className={styles.btn} onClick={onOpenProfile}>
                👤 Profile
              </button>
              <button className={styles.btn} onClick={onOpenSubscribe}>
                💎 Subscribe
              </button>
              {hasRole('admin') && (
                <button className={styles.btn} onClick={() => navigate('/admin')}>
                  ⚙️ Admin
                </button>
              )}
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={logout}>
                🚪 Logout
              </button>
            </>
          ) : (
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => navigate('/login')}>
              Login
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
