import { useState } from 'react';
import './AdminLogin.css';

const AdminLogin = ({ onLogin }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('adminToken', data.token);
        onLogin(data.admin);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Ошибка входа');
      }
    } catch (err) {
      setError('Ошибка соединения с сервером');
    }
    
    setLoading(false);
  };

  return (
    <div className="admin-login">
      <div className="admin-login-container">
        <div className="admin-login-header">
          <h2>Админ панель</h2>
          <p>CROCKY VAPE</p>
        </div>
        
        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="form-group">
            <label>Логин</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Введите логин"
              required
            />
          </div>
          
          <div className="form-group">
            <label>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              required
            />
          </div>
          
          {error && <div className="error">{error}</div>}
          
          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
