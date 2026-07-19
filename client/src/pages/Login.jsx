import React from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './Login.module.css';

const Login = () => {
  const { login } = useAuth();

  const handleFakeLogin = () => {
    login({ name: 'Demo User', phone: '918878923337' });
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <h2>Login to Important Days</h2>
        <button onClick={handleFakeLogin} className={styles.loginBtn}>Simulate Login</button>
      </div>
    </div>
  );
};

export default Login;
