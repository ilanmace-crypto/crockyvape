import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProducts, categories } from '../data/products';
import { useCart } from '../context/CartContext';
import ProductModal from '../components/ProductModal';
import './HomePage.css';

const HomePage = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [products, setProducts] = useState([]);
  const [selectedFlavors, setSelectedFlavors] = useState({});
  const [flavorModalProductId, setFlavorModalProductId] = useState(null);
  const [imageErrors, setImageErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalProduct, setModalProduct] = useState(null);
  const [modalSelectedFlavor, setModalSelectedFlavor] = useState('');
  const { addToCartWithFlavor } = useCart();

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getProducts();
        setProducts(data);
      } catch (err) {
        setError('Не удалось загрузить товары. Попробуйте обновить страницу.');
        console.error('Failed to load products:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  const filteredProducts = selectedCategory === 'all' 
    ? products.filter(product => {
        // Скрываем жидкости, у которых закончились все вкусы
        if (product.category === 'liquids') {
          const flavors = product.flavors ? Object.entries(product.flavors) : [];
          if (flavors.length === 0) return false; // нет вкусов — не показываем
          const hasStock = flavors.some(([, stock]) => stock > 0);
          return hasStock;
        }
        return true;
      })
    : products.filter(product => {
        const categoryMatch = product.category === selectedCategory;
        if (!categoryMatch) return false;

        if (product.category === 'liquids') {
          const flavors = product.flavors ? Object.entries(product.flavors) : [];
          if (flavors.length === 0) return false;
          const hasStock = flavors.some(([, stock]) => stock > 0);
          return hasStock;
        }
        return true;
      });

  const handleAddToCart = (product) => {
    if (product.category === 'liquids' && product.flavors) {
      const selectedFlavor = selectedFlavors[product.id];
      if (!selectedFlavor) {
        alert('Пожалуйста, выберите вкус');
        return;
      }
      addToCartWithFlavor(product, selectedFlavor, 1);
    } else {
      addToCartWithFlavor(product, null, 1);
    }
  };

  const handleFlavorSelect = (productId, flavor) => {
    setSelectedFlavors(prev => ({
      ...prev,
      [productId]: flavor
    }));
    setFlavorModalProductId(null);
  };

  const openFlavorModal = (productId) => {
    setFlavorModalProductId(productId);
  };

  const closeFlavorModal = () => {
    setFlavorModalProductId(null);
  };

  const handleImageError = (productId) => {
    setImageErrors(prev => ({
      ...prev,
      [productId]: true
    }));
  };

  const openModal = (product) => {
    setModalProduct(product);
    setModalSelectedFlavor('');
  };

  const closeModal = () => {
    setModalProduct(null);
    setModalSelectedFlavor('');
  };

  const handleModalAddToCart = (product, flavor) => {
    if (product.category === 'liquids' && product.flavors && !flavor) {
      alert('Пожалуйста, выберите вкус');
      return;
    }
    addToCartWithFlavor(product, flavor, 1);
  };

  const getPlaceholderImage = () => {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjI0MCIgdmlld0JveD0iMCAwIDMwMCAyNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMjQwIiBmaWxsPSJ1cmwoI2dyYWRpZW50MCkiLz4KPGRlZnM+CjxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZGllbnQwIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KPHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6I0Y4RjlGQTtzdG9wLW9wYWNpdHk6MSIgLz4KPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojRTlFQ0VGO3N0b3Atb3BhY2l0eToxIiAvPgo8L2xpbmVhckdyYWRpZW50Pgo8L2RlZnM+CjxwYXRoIGQ9Ik0xMjAgNzBIMTgwVjkwSDEyMFYxMTBIMTgwVjEzMEgxMjBWMTUwSDE4MFYxNzBIMTIwVjE5MEgxODBWNzBaIiBmaWxsPSIjREVERUQ2IiBmaWxsLW9wYWNpdHk9IjAuNiIvPgo8Y2lyY2xlIGN4PSIxNTAiIGN5PSI5NSIgcj0iOCIgZmlsbD0iI0RERERENiIgZmlsbC1vcGFjaXR5PSIwLjgiLz4KPHJlY3QgeD0iMTQwIiB5PSIxMTAiIHdpZHRoPSIyMCIgaGVpZ2h0PSI0MCIgZmlsbD0iI0RERERENiIgZmlsbC1vcGFjaXR5PSIwLjgiLz4KPHRleHQgeD0iMTUwIiB5PSIxODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZm9udC13ZWlnaHQ9IjUwMCI+Tm8gSW1hZ2U8L3RleHQ+Cjwvc3ZnPgo=';
  };

  return (
    <div className="home-page">
      <div className="container">
        <div className="hero-section">
          <h1 className="page-title">PARADISE_SHOP</h1>
          <p className="page-subtitle">Лучший выбор vape продукции</p>
        </div>
        
        <div className="categories">
          <button 
            className={`category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            Все товары
          </button>
          {categories.filter((c) => c.id === 'liquids').map(category => (
            <button
              key={category.id}
              className={`category-btn ${selectedCategory === category.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="products-section">
          {loading ? (
            <div className="loading-message">Загрузка товаров...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : filteredProducts.length === 0 ? (
            <div className="no-products">
              <h3>Товары не найдены</h3>
              <p>Попробуйте выбрать другую категорию или вернитесь позже</p>
            </div>
          ) : (
            <div className="products-grid">
              {filteredProducts.map(product => (
              <div key={product.id} className="product-card">
                <div className="product-image">
                  {imageErrors[product.id] ? (
                    <img 
                      src={getPlaceholderImage()} 
                      alt={product.name}
                      className="error"
                    />
                  ) : (
                    <img 
                      src={product.image} 
                      alt={product.name}
                      onError={() => handleImageError(product.id)}
                      onLoad={() => {
                        setImageErrors(prev => ({
                          ...prev,
                          [product.id]: false
                        }));
                      }}
                    />
                  )}
                </div>
                <div className="product-info">
                  <h3 className="product-name">{product.name}</h3>
                  <p className="product-description">{product.description}</p>

                  {product.category !== 'liquids' && typeof product.stock === 'number' && (
                    <div className={`stock-badge ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
                      {product.stock > 0 ? `В наличии: ${product.stock} шт.` : 'Нет в наличии'}
                    </div>
                  )}
                  
                  {product.category === 'liquids' && product.flavors && Object.keys(product.flavors).length > 0 && (
                    <div className="flavor-selector">
                      <label>Выберите вкус:</label>
                      <button
                        type="button"
                        className="flavor-dropdown-btn"
                        onClick={() => openFlavorModal(product.id)}
                      >
                        {selectedFlavors[product.id] || 'Выберите вкус'} ↓
                      </button>
                    </div>
                  )}
                  
                  <div className="product-footer">
                    <span className="product-price">{product.price} BYN</span>
                    <button 
                      onClick={() => handleAddToCart(product)} 
                      className="add-to-cart-btn"
                    >
                      В корзину
                    </button>
                  </div>
                </div>
              </div>
            ))
            }
            </div>
          )}
        </div>
      </div>
      
      <ProductModal
        product={modalProduct}
        isOpen={!!modalProduct}
        onClose={closeModal}
        onAddToCart={handleModalAddToCart}
        selectedFlavor={modalSelectedFlavor}
        setSelectedFlavor={setModalSelectedFlavor}
      />

      {flavorModalProductId !== null && (() => {
        const product = products.find((p) => p.id === flavorModalProductId);
        if (!product || !product.flavors) return null;
        return (
          <div className="flavor-modal-overlay" onClick={closeFlavorModal}>
            <div className="flavor-modal" onClick={(e) => e.stopPropagation()}>
              <div className="flavor-modal-header">
                <div className="flavor-modal-title">Выберите вкус</div>
                <button className="flavor-modal-close" onClick={closeFlavorModal} type="button">×</button>
              </div>
              <div className="flavor-modal-list">
                {Object.entries(product.flavors).map(([flavor, stock]) => (
                  <button
                    key={flavor}
                    type="button"
                    className={`flavor-modal-item ${stock === 0 ? 'out-of-stock' : ''}`}
                    onClick={() => {
                      if (stock > 0) handleFlavorSelect(product.id, flavor);
                    }}
                    disabled={stock === 0}
                  >
                    <span className="flavor-name">{flavor}</span>
                    <span className="flavor-stock">{stock > 0 ? `${stock} банок` : 'Нет в наличии'}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default HomePage;
