import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';

const LoginPage = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await login(password);
    if (success) {
      navigate('/admin');
    } else {
      setError('Неверный логин или пароль');
    }
  };

  return (
    <div className="login-page">
      <div className="container">
        <div className="login-form">
          <h1>Вход в админ панель</h1>
          <p>PARADISE_SHOP</p>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <input
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            {error && <div className="error">{error}</div>}
            
            <button type="submit" className="login-btn">Войти</button>
          </form>
          
          <div className="login-info">
            <p>Данные для входа:</p>
            <p>Логин: admin</p>
            <p>Пароль: paradise123</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
