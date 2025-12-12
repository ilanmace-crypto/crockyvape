import React from 'react';
import './ProductModal.css';

const ProductModal = ({ product, isOpen, onClose, onAddToCart, selectedFlavor, setSelectedFlavor }) => {
  if (!isOpen || !product) return null;

  // Парсим flavors, если это строка
  let flavors = {};
  if (product.flavors) {
    try {
      flavors = typeof product.flavors === 'string' ? JSON.parse(product.flavors) : product.flavors;
    } catch (e) {
      console.error('Failed to parse flavors in modal:', e);
      flavors = {};
    }
  }

  const handleAddToCart = () => {
    if (product.category === 'liquids' && Object.keys(flavors).length > 0 && !selectedFlavor) {
      alert('Пожалуйста, выберите вкус');
      return;
    }
    onAddToCart(product, selectedFlavor);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        
        <div className="modal-image">
          {product.image ? (
            <img src={product.image} alt={product.name} />
          ) : (
            <div className="no-image">Нет изображения</div>
          )}
        </div>

        <div className="modal-info">
          <h2>{product.name}</h2>
          <p className="modal-description">{product.description}</p>
          <p className="modal-price">{product.price} BYN</p>

          {product.category === 'liquids' && Object.keys(flavors).length > 0 && (
            <div className="modal-flavors">
              <h3>Выберите вкус:</h3>
              <div className="flavor-list">
                {Object.entries(flavors).map(([flavor, stock]) => (
                  <label key={flavor} className="flavor-option">
                    <input
                      type="radio"
                      name={`flavor-${product.id}`}
                      value={flavor}
                      checked={selectedFlavor === flavor}
                      onChange={() => setSelectedFlavor(flavor)}
                      disabled={stock === 0}
                    />
                    <span className={`flavor-label ${stock === 0 ? 'out-of-stock' : ''}`}>
                      {flavor} {stock > 0 ? `(${stock} банок)` : '(Нет в наличии)'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button className="modal-add-to-cart" onClick={handleAddToCart}>
              В корзину
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductModal;
