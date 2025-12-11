import React, { createContext, useState, useContext } from 'react';
import { login as apiLogin } from '../services/apiService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState(null);

  // Логин только по паролю: username всегда "admin"
  const login = async (password) => {
    try {
      const result = await apiLogin(password);

      // backend возвращает { success, user: { id, username, role } }
      if (result && result.success && result.user && result.user.role === 'admin') {
        setIsAuthenticated(true);
        setIsAdmin(true);
        setUser(result.user);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setIsAdmin(false);
    setUser(null);
  };

  const value = {
    isAuthenticated,
    isAdmin,
    user,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
