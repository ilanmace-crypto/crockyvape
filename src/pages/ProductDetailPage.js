import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProducts } from '../data/products';
import { useCart } from '../context/CartContext';
import './ProductDetailPage.css';

const ProductDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [selectedFlavor, setSelectedFlavor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [showFlavorModal, setShowFlavorModal] = useState(false);
  const { addToCartWithFlavor } = useCart();

  useEffect(() => {
    const products = getProducts();
    const foundProduct = products.find(p => p.id === parseInt(id));
    setProduct(foundProduct);
    
    if (foundProduct && foundProduct.category === 'liquids' && foundProduct.flavors) {
      const firstFlavor = Object.keys(foundProduct.flavors)[0];
      setSelectedFlavor(firstFlavor);
    }
  }, [id]);

  const openFlavorModal = () => {
    setShowFlavorModal(true);
  };

  const closeFlavorModal = () => {
    setShowFlavorModal(false);
  };

  const handleAddToCart = () => {
    if (product.category === 'liquids') {
      if (!selectedFlavor) {
        alert('Пожалуйста, выберите вкус');
        return;
      }
      
      const availableStock = product.flavors[selectedFlavor];
      if (availableStock < quantity) {
        alert(`Доступно только ${availableStock} банок вкуса "${selectedFlavor}"`);
        return;
      }

      addToCartWithFlavor(product, selectedFlavor, quantity);
    } else {
      addToCartWithFlavor(product, null, quantity);
    }
    
    navigate('/');
  };

  const getAvailableStock = (flavor) => {
    return product.flavors[flavor] || 0;
  };

  if (!product) {
    return <div className="loading">Загрузка...</div>;
  }

  return (
    <div className="product-detail-page">
      <div className="container">
        <button onClick={() => navigate('/')} className="back-btn">
          ← Назад к товарам
        </button>
        
        <div className="product-detail">
          <div className="product-image">
            <img src={product.image} alt={product.name} />
          </div>
          
          <div className="product-info">
            <h1 className="product-name">{product.name}</h1>
            <p className="product-description">{product.description}</p>
            <div className="product-price">{product.price} BYN</div>
            
            {product.category === 'liquids' && product.flavors && (
              <div className="flavor-selector">
                <label>Выберите вкус:</label>
                <button
                  type="button"
                  className="flavor-dropdown-btn"
                  onClick={openFlavorModal}
                >
                  {selectedFlavor || 'Выберите вкус'} ↓
                </button>
              </div>
            )}
            
            <div className="quantity-selector">
              <label>Количество:</label>
              <div className="quantity-controls">
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="quantity-btn"
                >
                  -
                </button>
                <input 
                  type="number" 
                  value={quantity} 
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="quantity-input"
                  min="1"
                  max={product.category === 'liquids' && selectedFlavor ? getAvailableStock(selectedFlavor) : 99}
                />
                <button 
                  onClick={() => {
                    const maxStock = product.category === 'liquids' && selectedFlavor 
                      ? getAvailableStock(selectedFlavor) 
                      : 99;
                    setQuantity(Math.min(maxStock, quantity + 1));
                  }}
                  className="quantity-btn"
                >
                  +
                </button>
              </div>
            </div>
            
            <div className="product-actions">
              <button 
                onClick={handleAddToCart}
                className="add-to-cart-btn"
                disabled={
                  (product.category === 'liquids' && (!selectedFlavor || getAvailableStock(selectedFlavor) < quantity)) ||
                  !product.inStock
                }
              >
                {!product.inStock ? 'Нет в наличии' : 'Добавить в корзину'}
              </button>
            </div>

            {showFlavorModal && product.category === 'liquids' && product.flavors && (
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
                          if (stock > 0) {
                            setSelectedFlavor(flavor);
                            setQuantity(1);
                            closeFlavorModal();
                          }
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
