import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage or make an API call to verify session
    const activeSession = localStorage.getItem('importantDays_session_active');
    if (activeSession === 'true') {
      const storedUser = localStorage.getItem('importantDays_user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    }
    setLoading(false);
  }, []);

  const login = (userData) => {
    localStorage.setItem('importantDays_session_active', 'true');
    localStorage.setItem('importantDays_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('importantDays_session_active');
    localStorage.removeItem('importantDays_user');
    setUser(null);
  };

  const hasRole = (role) => {
    // Basic role check example. E.g., admin if phone is specific number.
    if (role === 'admin' && user?.phone) {
        const normPhone = user.phone.replace(/\D/g, '');
        return (normPhone === '8878923337' || normPhone === '918878923337');
    }
    return true;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, hasRole }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
