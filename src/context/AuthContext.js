import React, { createContext, useState, useContext } from 'react';
import { sendOrderNotification } from '../services/telegram';
import { useUser } from './UserContext';
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

  const login = async (password) => {
    try {
      const trimmed = (password || '').trim();
      if (!trimmed) {
        console.error('Empty password provided');
        return { success: false, error: 'Password is required' };
      }
      
      console.log('Attempting login with password:', trimmed);
      const result = await apiLogin(trimmed);
      console.log('Login response:', result);

      if (result && result.success && result.user && result.user.role === 'admin') {
        setIsAuthenticated(true);
        setIsAdmin(true);
        setUser(result.user);
        return { success: true };
      }

      return { 
        success: false, 
        error: result?.error || 'Invalid credentials' 
      };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed. Please try again.' 
      };
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
