import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useUser } from '../context/UserContext';
import { FiShoppingCart, FiUser, FiLogIn, FiLogOut, FiMenu, FiX } from 'react-icons/fi';
import { FaUserShield } from 'react-icons/fa';
import './Header.css';

const Header = () => {
  const { isAuthenticated, isAdmin, login, logout } = useAuth();
  const { getTotalItems } = useCart();
  const { currentUser } = useUser();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 20;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };

    document.addEventListener('scroll', handleScroll);
    return () => document.removeEventListener('scroll', handleScroll);
  }, [scrolled]);

  useEffect(() => {
    return () => setMobileMenuOpen(false);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const result = await login(loginData.username, loginData.password);
      if (result?.success) {
        setShowLoginModal(false);
        setLoginData({ username: '', password: '' });
      } else {
        setError(result?.error || 'Неверный логин или пароль');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Ошибка при входе. Пожалуйста, попробуйте снова.');
    }
  };

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setLoginData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <>
      <header className={`header ${scrolled ? 'scrolled' : ''}`}>
        <div className="container">
          <Link to="/" className="logo" onClick={() => setMobileMenuOpen(false)}>
            VAPE<span>PARADISE</span>
          </Link>
          
          <nav className={`nav-links ${mobileMenuOpen ? 'active' : ''}`}>
            <Link to="/" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
              Главная
            </Link>
            <Link to="/cart" className="nav-link cart-link" onClick={() => setMobileMenuOpen(false)}>
              <FiShoppingCart className="icon" />
              <span>Корзина</span>
              {getTotalItems() > 0 && <span className="cart-count">{getTotalItems()}</span>}
            </Link>
            
            {isAuthenticated ? (
              <>
                {isAdmin && (
                  <Link to="/admin" className="nav-link admin-link" onClick={() => setMobileMenuOpen(false)}>
                    <FaUserShield className="icon" />
                    <span>Админка</span>
                  </Link>
                )}
                <Link to="/profile" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
                  <FiUser className="icon" />
                  <span>Профиль</span>
                </Link>
                <button onClick={handleLogout} className="nav-link logout-btn">
                  <FiLogOut className="icon" />
                  <span>Выйти</span>
                </button>
              </>
            ) : (
              <button 
                onClick={() => setShowLoginModal(true)} 
                className="nav-link login-btn"
              >
                <FiLogIn className="icon" />
                <span>Войти</span>
              </button>
            )}
          </nav>
          
          <button 
            className="mobile-menu-toggle" 
            onClick={toggleMobileMenu}
            aria-label={mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
          >
            {mobileMenuOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </header>

      <div className={`modal-overlay ${showLoginModal ? 'active' : ''}`} onClick={() => setShowLoginModal(false)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h2>Вход в аккаунт</h2>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <input
                type="text"
                name="username"
                placeholder="Имя пользователя"
                value={loginData.username}
                onChange={handleInputChange}
                required
                autoComplete="username"
              />
            </div>
            <div className="form-group">
              <input
                type="password"
                name="password"
                placeholder="Пароль"
                value={loginData.password}
                onChange={handleInputChange}
                required
                autoComplete="current-password"
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            <button type="submit">Войти</button>
          </form>
          <div className="login-hint">
            <p>Тестовые данные:</p>
            <p>Логин: <strong>admin</strong></p>
            <p>Пароль: <strong>paradise251208</strong></p>
          </div>
        </div>
      </div>
      
      {mobileMenuOpen && (
        <div 
          className="mobile-menu-overlay" 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  );
};

export default Header;
