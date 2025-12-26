import React, { useState, useEffect } from 'react';
import './AdminPanel.css';

const AdminPanel = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Загрузка данных с API
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Загрузка товаров
      const productsResponse = await fetch('https://paradise-shop-api-production.up.railway.app/api/products');
      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        setProducts(productsData);
      } else {
        throw new Error('Failed to load products');
      }
      
      // Временно загружаем мок данные для заказов и пользователей
      setOrders([
        { id: 1, customer: 'User1', items: 2, total: 50, status: 'pending', date: '26.12.2024' },
        { id: 2, customer: 'User2', items: 1, total: 25, status: 'completed', date: '26.12.2024' }
      ]);
      
      setUsers([
        { id: 1, name: 'User1', email: 'user1@example.com', orders: 2, total: 50 },
        { id: 2, name: 'User2', email: 'user2@example.com', orders: 1, total: 25 }
      ]);
      
      setStats({
        totalOrders: 2,
        totalRevenue: 75,
        totalUsers: 2,
        avgOrderValue: 37.5,
        topProducts: ['PARADISE Liquid 30ml', 'Salt 20mg 30ml']
      });
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (product) => {
    try {
      const response = await fetch('https://paradise-shop-api-production.up.railway.app/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(product),
      });
      
      if (response.ok) {
        const newProduct = await response.json();
        setProducts([...products, newProduct]);
        setShowAddProduct(false);
      } else {
        throw new Error('Failed to add product');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditProduct = async (product) => {
    try {
      const response = await fetch(`https://paradise-shop-api-production.up.railway.app/api/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(product),
      });
      
      if (response.ok) {
        const updatedProduct = await response.json();
        setProducts(products.map(p => p.id === product.id ? updatedProduct : p));
        setEditingProduct(null);
      } else {
        throw new Error('Failed to update product');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm('Удалить товар?')) return;
    
    try {
      const response = await fetch(`https://paradise-shop-api-production.up.railway.app/api/products/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setProducts(products.filter(p => p.id !== id));
      } else {
        throw new Error('Failed to delete product');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateOrderStatus = async (orderId, status) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      
      if (response.ok) {
        setOrders(orders.map(o => o.id === orderId ? { ...o, status } : o));
      } else {
        throw new Error('Failed to update order status');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const renderProducts = () => (
    <div className="admin-section">
      <div className="section-header">
        <h3>Управление товарами</h3>
        <button className="admin-button primary" onClick={() => setShowAddProduct(true)}>
          + Добавить товар
        </button>
      </div>
      
      {loading ? (
        <div className="loading">Загрузка...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <div className="products-grid">
          {products.map(product => (
            <div key={product.id} className="product-card">
              <div className="product-info">
                <h4>{product.name}</h4>
                <p className="price">{product.price} BYN</p>
                <p className="category">{product.category === 'liquids' ? 'Жидкости' : 'Расходники'}</p>
                {product.flavor && <p className="flavor">Вкус: {product.flavor}</p>}
                <p className="stock">На складе: {product.stock || 0}</p>
              </div>
              <div className="product-actions">
                <button onClick={() => setEditingProduct(product)} className="btn-edit">
                  Редактировать
                </button>
                <button onClick={() => handleDeleteProduct(product.id)} className="btn-delete">
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showAddProduct || editingProduct) && (
        <ProductForm
          product={editingProduct}
          onSubmit={editingProduct ? handleEditProduct : handleAddProduct}
          onCancel={() => {
            setShowAddProduct(false);
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );

  const renderOrders = () => (
    <div className="admin-section">
      <h3>Управление заказами</h3>
      {loading ? (
        <div className="loading">Загрузка...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <div className="orders-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Клиент</th>
                <th>Товары</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th>Дата</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td>#{order.id}</td>
                  <td>{order.customer || 'Не указано'}</td>
                  <td>{order.items || 0} шт.</td>
                  <td>{order.total || 0} BYN</td>
                  <td>
                    <select 
                      value={order.status || 'pending'} 
                      onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                      className="status-select"
                    >
                      <option value="pending">Ожидает</option>
                      <option value="processing">В обработке</option>
                      <option value="completed">Выполнен</option>
                      <option value="cancelled">Отменен</option>
                    </select>
                  </td>
                  <td>{order.date || new Date().toLocaleDateString()}</td>
                  <td>
                    <button className="btn-view">Просмотр</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderUsers = () => (
    <div className="admin-section">
      <h3>Управление пользователями</h3>
      {loading ? (
        <div className="loading">Загрузка...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <div className="users-grid">
          {users.map(user => (
            <div key={user.id} className="user-card">
              <div className="user-info">
                <h4>{user.name || 'Пользователь'}</h4>
                <p className="email">{user.email || 'Нет email'}</p>
                <p className="orders">Заказы: {user.orders || 0}</p>
                <p className="total">Покупки: {user.total || 0} BYN</p>
              </div>
              <div className="user-actions">
                <button className="btn-view">Профиль</button>
                <button className="btn-block">Заблокировать</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderStats = () => (
    <div className="admin-section">
      <h3>Статистика</h3>
      {loading ? (
        <div className="loading">Загрузка...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <h4>Всего заказов</h4>
              <p className="stat-number">{stats?.totalOrders || 0}</p>
            </div>
            <div className="stat-card">
              <h4>Общая выручка</h4>
              <p className="stat-number">{stats?.totalRevenue || 0} BYN</p>
            </div>
            <div className="stat-card">
              <h4>Пользователи</h4>
              <p className="stat-number">{stats?.totalUsers || 0}</p>
            </div>
            <div className="stat-card">
              <h4>Средний чек</h4>
              <p className="stat-number">{stats?.avgOrderValue || 0} BYN</p>
            </div>
          </div>
          
          <div className="top-products">
            <h4>Популярные товары</h4>
            <ul>
              {stats?.topProducts?.map((product, index) => (
                <li key={index}>{index + 1}. {product}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2>Админ панель</h2>
        <button className="logout-button" onClick={onLogout}>
          Выйти
        </button>
      </div>
      
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          Товары
        </button>
        <button
          className={`admin-tab ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          Заказы
        </button>
        <button
          className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Пользователи
        </button>
        <button
          className={`admin-tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Статистика
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'products' && renderProducts()}
        {activeTab === 'orders' && renderOrders()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'stats' && renderStats()}
      </div>
    </div>
  );
};

function ProductForm({ product, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    price: product?.price || '',
    category: product?.category || 'liquids',
    flavor: product?.flavor || '',
    stock: product?.stock || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      price: Number(formData.price),
      stock: Number(formData.stock),
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>{product ? 'Редактировать товар' : 'Добавить товар'}</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="product-form">
          <div className="form-group">
            <label>Название товара</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Цена (BYN)</label>
            <input
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Категория</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            >
              <option value="liquids">Жидкости</option>
              <option value="consumables">Расходники</option>
            </select>
          </div>
          {formData.category === 'liquids' && (
            <div className="form-group">
              <label>Вкус</label>
              <input
                type="text"
                value={formData.flavor}
                onChange={(e) => setFormData({ ...formData, flavor: e.target.value })}
                placeholder="Например: Ягодный, Мятный, Табачный"
              />
            </div>
          )}
          <div className="form-group">
            <label>Количество на складе</label>
            <input
              type="number"
              value={formData.stock}
              onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
              required
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">
              {product ? 'Сохранить' : 'Добавить'}
            </button>
            <button type="button" onClick={onCancel} className="btn-secondary">
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminPanel;
