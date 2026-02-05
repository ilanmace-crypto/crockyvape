import React, { useState, useEffect } from 'react';
import './AdminPanel.css';

const AdminPanel = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const normalizeProduct = (p) => {
    const category = Number(p?.category_id) === 1
      ? 'liquids'
      : (Number(p?.category_id) === 2 ? 'consumables' : (p?.category || null));

    const flavors = Array.isArray(p?.flavors)
      ? p.flavors
        .map((f) => {
          if (typeof f === 'string') {
            return { flavor_name: f, stock: 0 };
          }
          return {
            flavor_name: f?.flavor_name || f?.name || '',
            stock: Number(f?.stock ?? 0),
          };
        })
        .filter((f) => f.flavor_name)
      : [];

    return {
      ...p,
      category,
      flavors,
    };
  };

  // Загрузка данных с API
  useEffect(() => {
    loadProducts();
    loadStats();
    loadReviews();
  }, []);

  const getTokenOrLogout = () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      onLogout();
      throw new Error('No authentication token');
    }
    return token;
  };

  const handleUnauthorized = () => {
    localStorage.removeItem('adminToken');
    onLogout();
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const token = getTokenOrLogout();

      // Загрузка только товаров
      const productsResponse = await fetch('/admin/products', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        const normalizedProducts = Array.isArray(productsData) ? productsData.map(normalizeProduct) : [];
        setProducts(normalizedProducts);
      } else if (productsResponse.status === 401) {
        handleUnauthorized();
        return;
      } else {
        const errBody = await productsResponse.json().catch(() => null);
        throw new Error(errBody?.error || 'Failed to load products');
      }
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const token = getTokenOrLogout();
      const response = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else if (response.status === 401) {
        handleUnauthorized();
      } else {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.error || 'Failed to load stats');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadReviews = async () => {
    setReviewsLoading(true);
    try {
      const token = getTokenOrLogout();
      const response = await fetch('/api/admin/reviews', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setReviews(Array.isArray(data) ? data : []);
      } else if (response.status === 401) {
        handleUnauthorized();
      } else {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.error || 'Failed to load reviews');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setReviewsLoading(false);
    }
  };

  const updateReviewApproval = async (reviewId, isApproved) => {
    try {
      const token = getTokenOrLogout();
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ is_approved: isApproved }),
      });

      if (response.ok) {
        await loadReviews();
        await loadStats();
        return;
      }
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      const errBody = await response.json().catch(() => null);
      throw new Error(errBody?.error || 'Failed to update review');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddProduct = async (product) => {
    try {
      const token = getTokenOrLogout();
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
        await loadProducts();
        await loadStats();
        setShowAddProduct(false);
      } else if (response.status === 401) {
        handleUnauthorized();
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
      const token = getTokenOrLogout();
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
        await loadStats();
      } else if (response.status === 401) {
        handleUnauthorized();
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
      const token = getTokenOrLogout();
      const response = await fetch(`/admin/products/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        setProducts(products.filter(p => p.id !== id));
        await loadStats();
      } else if (response.status === 401) {
        handleUnauthorized();
      } else {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.error || 'Failed to delete product');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const formatMoney = (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '0.00';
    return n.toFixed(2);
  };

  const renderDashboard = () => (
    <div className="admin-section">
      <div className="section-header">
        <h3>Статистика (30 дней)</h3>
        <button className="admin-button" onClick={() => { loadStats(); loadReviews(); loadProducts(); }}>
          Обновить
        </button>
      </div>

      {statsLoading ? (
        <div className="loading">Загрузка статистики...</div>
      ) : stats ? (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <h4>Заказов</h4>
              <p className="stat-number">{stats?.total?.total_orders || 0}</p>
            </div>
            <div className="stat-card">
              <h4>Клиентов</h4>
              <p className="stat-number">{stats?.total?.total_customers || 0}</p>
            </div>
            <div className="stat-card">
              <h4>Выручка</h4>
              <p className="stat-number">{formatMoney(stats?.total?.total_revenue)} BYN</p>
            </div>
            <div className="stat-card">
              <h4>Средний чек</h4>
              <p className="stat-number">{formatMoney(stats?.total?.avg_order_value)} BYN</p>
            </div>
          </div>

          <div className="top-products">
            <h4>⚠️ Низкие остатки</h4>
            {Array.isArray(stats?.lowStock) && stats.lowStock.length > 0 ? (
              <ul>
                {stats.lowStock.map((it, idx) => (
                  <li key={`${it.name}-${idx}`}>
                    {it.name} — {it.stock} шт. ({it.category_name})
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ color: '#ccc' }}>Все товары в норме</div>
            )}

            {Array.isArray(stats?.lowStockFlavors) && stats.lowStockFlavors.length > 0 && (
              <>
                <h4 style={{ marginTop: 16 }}>⚠️ Низкие остатки по вкусам</h4>
                <ul>
                  {stats.lowStockFlavors.map((it, idx) => (
                    <li key={`${it.product_name}-${it.flavor_name}-${idx}`}>
                      {it.product_name} / {it.flavor_name} — {it.stock} шт.
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="top-products" style={{ marginTop: 20 }}>
            <h4>🔥 Топ товары</h4>
            {Array.isArray(stats?.topProducts) && stats.topProducts.length > 0 ? (
              <ul>
                {stats.topProducts.map((p, idx) => (
                  <li key={`${p.name}-${idx}`}>
                    {p.name} — {p.total_quantity} шт · {formatMoney(p.revenue)} BYN
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ color: '#ccc' }}>Пока нет данных</div>
            )}
          </div>
        </>
      ) : (
        <div className="loading">Нет данных статистики</div>
      )}
    </div>
  );

  const renderProducts = () => (
    <div className="admin-section">
      <div className="section-header">
        <h3>Управление товарами</h3>
        <button className="admin-button primary" onClick={() => {
          setShowAddProduct(true);
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

  const renderReviews = () => (
    <div className="admin-section">
      <div className="section-header">
        <h3>Отзывы (модерация)</h3>
        <button className="admin-button" onClick={loadReviews}>Обновить</button>
      </div>

      {reviewsLoading ? (
        <div className="loading">Загрузка отзывов...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {reviews.length === 0 ? (
            <div className="loading">Отзывов пока нет</div>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="product-card">
                <div className="product-info">
                  <h4>{r.telegram_username || 'Аноним'} {r.is_approved ? '✅' : '⏳'}</h4>
                  <p className="price">{'⭐'.repeat(Number(r.rating || 0))}{'☆'.repeat(5 - Number(r.rating || 0))}</p>
                  <p style={{ color: '#ccc' }}>{r.review_text}</p>
                  <p style={{ color: '#888', fontSize: 12 }}>{r.created_at ? new Date(r.created_at).toLocaleString('ru-RU') : ''}</p>
                </div>
                <div className="product-actions">
                  {!r.is_approved && (
                    <button
                      onClick={() => updateReviewApproval(r.id, true)}
                      className="btn-edit"
                    >
                      Одобрить
                    </button>
                  )}
                  {r.is_approved && (
                    <button
                      onClick={() => updateReviewApproval(r.id, false)}
                      className="btn-delete"
                    >
                      Скрыть
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
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
          className={`admin-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Главная
        </button>
        <button
          className={`admin-tab ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          Товары
        </button>
        <button
          className={`admin-tab ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => setActiveTab('reviews')}
        >
          Отзывы
        </button>
      </div>
      
      <div className="admin-content">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'products' && renderProducts()}
        {activeTab === 'reviews' && renderReviews()}
      </div>
    </div>
  );
};

function ProductForm({ product, onSubmit, onCancel }) {
  const initialFlavors = Array.isArray(product?.flavors)
    ? product.flavors.map((f) => {
      if (typeof f === 'string') {
        return { name: f, stock: 0 };
      }
      return {
        name: f?.flavor_name || f?.name || '',
        stock: Number(f?.stock ?? 0),
      };
    }).filter((f) => f.name)
    : [];

  const [formData, setFormData] = useState({
    name: product?.name || '',
    price: product?.price || '',
    category: product?.category || (Number(product?.category_id) === 2 ? 'consumables' : 'liquids'),
    stock: product?.stock ?? '',
    flavors: initialFlavors.length > 0 ? initialFlavors : [{ name: '', stock: 0 }],
    image_url: product?.image_url || '',
  });

  const [imagePreview, setImagePreview] = useState(product?.image_url || '');

  const [submitting, setSubmitting] = useState(false);

  const handleImageFile = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      setFormData((prev) => ({ ...prev, image_url: dataUrl }));
      setImagePreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const isLiquids = formData.category === 'liquids';
      const normalizedFlavors = isLiquids
        ? (Array.isArray(formData.flavors) ? formData.flavors : [])
          .map((f) => ({
            name: String(f?.name || '').trim(),
            stock: Number(f?.stock === '' ? 0 : (f?.stock ?? 0))
          }))
          .filter((f) => f.name)
        : [];

      if (isLiquids && normalizedFlavors.length === 0) {
        throw new Error('Добавь хотя бы 1 вкус');
      }

      const totalStock = isLiquids
        ? normalizedFlavors.reduce((sum, f) => sum + Number(f.stock || 0), 0)
        : Number(formData.stock);

      const data = {
        ...(product?.id ? { id: product.id } : {}),
        name: String(formData.name || '').trim(),
        price: Number(formData.price),
        category: formData.category,
        stock: totalStock,
        flavors: normalizedFlavors,
        image_url: formData.image_url || null,
      };
      await onSubmit(data);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-modal-overlay" onClick={onCancel}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>{product ? 'Редактировать товар' : 'Добавить товар'}</h3>
          <button className="admin-modal-close" onClick={onCancel}>×</button>
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
              min="0"
              step="0.01"
              required
            />
          </div>
          <div className="form-group">
            <label>Фото товара</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageFile(e.target.files?.[0])}
            />
            {imagePreview && (
              <div style={{ marginTop: 10 }}>
                <img
                  src={imagePreview}
                  alt="preview"
                  style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8 }}
                />
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <input
                type="text"
                placeholder="или вставь URL картинки"
                value={typeof formData.image_url === 'string' ? formData.image_url : ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setFormData({ ...formData, image_url: v });
                  setImagePreview(v);
                }}
              />
            </div>
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

          {formData.category === 'liquids' ? (
            <div className="form-group">
              <label>Вкусы и количество банок</label>
              <div style={{ display: 'grid', gap: 8 }}>
                {formData.flavors.map((flavorRow, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 140px 40px',
                      gap: 8,
                      alignItems: 'center'
                    }}
                  >
                    <input
                      type="text"
                      value={flavorRow.name}
                      onChange={(e) => {
                        const next = [...formData.flavors];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setFormData({ ...formData, flavors: next });
                      }}
                      placeholder="Вкус (например: Mango Ice)"
                      required
                    />
                    <input
                      type="number"
                      value={flavorRow.stock}
                      onChange={(e) => {
                        const next = [...formData.flavors];
                        const raw = e.target.value;
                        next[idx] = { ...next[idx], stock: raw === '' ? '' : Number(raw) };
                        setFormData({ ...formData, flavors: next });
                      }}
                      min="0"
                      placeholder="Кол-во"
                      required
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        const next = formData.flavors.filter((_, i) => i !== idx);
                        setFormData({ ...formData, flavors: next.length ? next : [{ name: '', stock: 0 }] });
                      }}
                      aria-label="Удалить вкус"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setFormData({ ...formData, flavors: [...formData.flavors, { name: '', stock: 0 }] })}
                >
                  + Добавить вкус
                </button>
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label>Количество на складе</label>
              <input
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                min="0"
                required
              />
            </div>
          )}
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Сохраняем...' : (product ? 'Сохранить' : 'Добавить')}
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
