import React, { memo, useMemo, useState } from 'react';
import ProductCard from './ProductCard';

const VirtualizedProductGrid = memo(({ products, selectedFlavor, onFlavorSelect, onAddToCart, onImageError, imageErrors }) => {
  const [showAll, setShowAll] = useState(false);
  
  // Виртуализация - показываем только первые 12 товаров для максимальной производительности
  const visibleProducts = useMemo(() => {
    return showAll ? products : products.slice(0, 12);
  }, [products, showAll]);

  // Если товаров больше 12, показываем кнопку "Загрузить еще"
  const hasMore = products.length > 12;

  const handleShowAll = () => {
    setShowAll(true);
  };

  return (
    <div>
      <div className="products-grid">
        {visibleProducts.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            selectedFlavor={selectedFlavor[product.id]}
            onFlavorSelect={onFlavorSelect}
            onAddToCart={onAddToCart}
            onImageError={onImageError}
            imageError={imageErrors[product.id]}
          />
        ))}
      </div>
      
      {hasMore && !showAll && (
        <div className="load-more-container">
          <p className="showing-count">
            Показано {visibleProducts.length} из {products.length} товаров
          </p>
          <button 
            className="load-more-btn"
            onClick={handleShowAll}
          >
            Показать все товары ({products.length})
          </button>
        </div>
      )}
    </div>
  );
});

VirtualizedProductGrid.displayName = 'VirtualizedProductGrid';

export default VirtualizedProductGrid;
