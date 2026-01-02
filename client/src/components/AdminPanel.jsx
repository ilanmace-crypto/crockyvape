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

  const normalizeProduct = (p) => {
    const category = Number(p?.category_id) === 1
      ? 'liquids'
      : (Number(p?.category_id) === 2 ? 'consumables' : (p?.category || null));

    const flavors = Array.isArray(p?.flavors)
      ? p.flavors
        .map((f) => (typeof f === 'string' ? f : (f.flavor_name || f.name)))
        .filter(Boolean)
      : [];

    return {
      ...p,
      category,
      flavors,
    };
  };

  // Загрузка данных с API
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        throw new Error('No authentication token');
      }

      // Загрузка всех данных с реального API
      const [productsResponse, ordersResponse, usersResponse, statsResponse] = await Promise.all([
        fetch('/admin/products', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/admin/orders', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/admin/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/admin/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        const normalizedProducts = Array.isArray(productsData) ? productsData.map(normalizeProduct) : [];
        setProducts(normalizedProducts);
      } else if (productsResponse.status === 401) {
        localStorage.removeItem('adminToken');
        onLogout();
        return;
      }
      
      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json();
        setOrders(ordersData);
      }
      
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData);
      } else if (usersResponse.status === 401) {
        localStorage.removeItem('adminToken');
        onLogout();
        return;
      }
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        const totalOrders = Number(statsData?.orders?.total_orders || 0);
        const totalRevenue = Number(statsData?.orders?.total_revenue || 0);
        const totalUsers = Number(statsData?.users?.count || 0);
        const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

        setStats({
          totalOrders,
          totalRevenue,
          totalUsers,
          avgOrderValue,
          topProducts: [],
        });
      } else if (statsResponse.status === 401) {
        localStorage.removeItem('adminToken');
        onLogout();
        return;
      }
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (product) => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        throw new Error('No authentication token');
      }
      const response = await fetch('/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(product),
      });
      
      if (response.ok) {
        const newProduct = await response.json();
        setProducts((prev) => [...prev, normalizeProduct(newProduct)]);
        await loadData();
        setShowAddProduct(false);
      } else if (response.status === 401) {
        localStorage.removeItem('adminToken');
        onLogout();
      } else {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.error || 'Failed to add product');
      }
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const handleEditProduct = async (product) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/admin/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(product),
      });
      
      if (response.ok) {
        const updatedProduct = await response.json();
        const normalized = normalizeProduct(updatedProduct);
        setProducts(products.map(p => p.id === product.id ? normalized : p));
        setEditingProduct(null);
      } else if (response.status === 401) {
        localStorage.removeItem('adminToken');
        onLogout();
      } else {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.error || 'Failed to update product');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm('Удалить товар?')) return;
    
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/admin/products/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        setProducts(products.filter(p => p.id !== id));
      } else if (response.status === 401) {
        localStorage.removeItem('adminToken');
        onLogout();
      } else {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.error || 'Failed to delete product');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateOrderStatus = async (orderId, status) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status }),
      });
      
      if (response.ok) {
        const updatedOrder = await response.json();
        setOrders(orders.map(o => o.id === orderId ? updatedOrder : o));
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
        <button className="admin-button primary" onClick={() => {
          console.log('Клик по кнопке Добавить товар');
          alert('Клик по кнопке Добавить товар сработал! showAddProduct = ' + showAddProduct);
          setShowAddProduct(true);
          console.log('setShowAddProduct(true) вызван');
        }}>
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
        <>
          {/* Временная отладочная модалка */}
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 255, 0, 0.9)',
            zIndex: 999999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '24px',
            color: '#000',
            fontWeight: 'bold'
          }}>
            <div>
              МОДАЛКА РАБОТАЕТ! showAddProduct = {showAddProduct ? 'true' : 'false'}
              <br /><br />
              <button onClick={() => {
                setShowAddProduct(false);
                setEditingProduct(null);
              }} style={{
                padding: '10px 20px',
                fontSize: '18px',
                background: '#fff',
                border: '2px solid #000',
                cursor: 'pointer'
              }}>
                Закрыть
              </button>
            </div>
          </div>
          
          <ProductForm
            product={editingProduct}
            onSubmit={editingProduct ? handleEditProduct : handleAddProduct}
            onCancel={() => {
              setShowAddProduct(false);
              setEditingProduct(null);
            }}
          />
        </>
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
  console.log('ProductForm рендерится!', { product, onSubmit, onCancel });
  
  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: '#ff00ff',
      border: '5px solid #00ff00',
      padding: '30px',
      zIndex: 99999,
      color: '#000',
      fontSize: '20px'
    }}>
      <h2>PRODUCT FORM РАБОТАЕТ!</h2>
      <p>product: {JSON.stringify(product)}</p>
      <button 
        onClick={onCancel}
        style={{
          background: '#ff0000',
          color: '#fff',
          padding: '10px 20px',
          border: 'none',
          cursor: 'pointer'
        }}
      >
        ЗАКРЫТЬ
      </button>
    </div>
  );
}

export default AdminPanel;
