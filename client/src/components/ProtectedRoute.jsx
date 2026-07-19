import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { user, loading, hasRole } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !hasRole('admin')) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
