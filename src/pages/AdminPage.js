import React, { useState, useEffect } from 'react';
import { getProducts, createProduct, updateProduct, deleteProduct as deleteProductApi } from '../data/products';
import { categories } from '../data/products';
import { fileToBase64, isValidImageFile, formatFileSize } from '../utils/imageUtils';
import './AdminPage.css';

const AdminPage = () => {
  const [products, setProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newFlavorInputs, setNewFlavorInputs] = useState({}); // { productId: { name, stock } }
  const [uploadingImage, setUploadingImage] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('liquids');

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await getProducts();
        // Проставляем поле category по имени категории из бэкенда,
        // чтобы корректно работала логика для жидкостей и вкусов
        const withCategory = data.map((product) => {
          const matchedCategory = categories.find(
            (cat) => cat.name === product.category_name
          );

          return {
            ...product,
            category: matchedCategory ? matchedCategory.id : product.category || 'liquids',
          };
        });

        setProducts(withCategory);
      } catch (err) {
        console.error('Failed to load products:', err);
      }
    };

    loadProducts();
  }, []);

  const addProduct = async () => {
    try {
      const newProduct = {
        name: 'Новый товар',
        category: selectedCategory,
        price: 0,
        image: '',
        description: '',
        in_stock: true,
        flavors: selectedCategory === 'liquids' ? {} : undefined
      };

      const created = await createProduct(newProduct);

      // Добавляем локальное поле category, чтобы сразу отображались
      // правильные блоки (например, вкусы для жидкостей)
      const createdWithCategory = {
        ...created,
        category: selectedCategory,
      };

      setProducts(prev => [...prev, createdWithCategory]);
      setEditingProduct(created.id);
    } catch (err) {
      console.error('Failed to add product:', err);
      alert('Ошибка при добавлении товара');
    }
  };

  const deleteProductHandler = async (productId) => {
    if (!window.confirm('Уверен, что хочешь удалить этот товар?')) {
      return;
    }

    try {
      await deleteProductApi(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
      if (editingProduct === productId) {
        setEditingProduct(null);
      }
    } catch (err) {
      console.error('Failed to delete product:', err);
      alert('Ошибка при удалении товара');
    }
  };

  const handleProductChange = (productId, field, value) => {
    setProducts(prev => prev.map(product => 
      product.id === productId ? { ...product, [field]: value } : product
    ));
  };

  const handleFlavorChange = (productId, flavorName, newStock) => {
    setProducts(prev => prev.map(product => {
      if (product.id === productId && product.flavors) {
        const updatedFlavors = { ...product.flavors };
        if (newStock === 0) {
          delete updatedFlavors[flavorName];
        } else {
          updatedFlavors[flavorName] = newStock;
        }
        return { ...product, flavors: updatedFlavors };
      }
      return product;
    }));
  };

  const handleImageUpload = async (productId, file) => {
    if (!isValidImageFile(file)) {
      alert('Пожалуйста, выберите изображение (JPEG, PNG, GIF, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Размер файла не должен превышать 5MB');
      return;
    }

    setUploadingImage(productId);
    
    try {
      const base64Image = await fileToBase64(file);
      setProducts(prev => prev.map(product => 
        product.id === productId ? { ...product, image: base64Image } : product
      ));
    } catch (error) {
      alert('Ошибка при загрузке изображения: ' + error.message);
    } finally {
      setUploadingImage(null);
    }
  };

  const addFlavor = (productId) => {
    const input = newFlavorInputs[productId] || { name: '', stock: 1 };
    if (input.name.trim()) {
      setProducts(prev => prev.map(product => {
        if (product.id === productId) {
          const flavors = product.flavors || {};
          return {
            ...product,
            flavors: {
              ...flavors,
              [input.name.trim()]: input.stock
            }
          };
        }
        return product;
      }));
      // Сбрасываем поля для этого товара
      setNewFlavorInputs(prev => ({
        ...prev,
        [productId]: { name: '', stock: 1 }
      }));
    }
  };

  const updateNewFlavorInput = (productId, field, value) => {
    setNewFlavorInputs(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: field === 'stock' ? parseInt(value) || 1 : value
      }
    }));
  };

  const saveChanges = async () => {
    try {
      for (const product of products) {
        // Находим category_id по имени категории
        const matchedCategory = categories.find(
          (cat) => cat.name === product.category_name
        );
        const category_id = matchedCategory ? matchedCategory.id : null;

        const payload = {
          ...product,
          category_id,
        };
        console.log('Saving product payload:', payload);

        await updateProduct(product.id, payload);
      }
      alert('Изменения сохранены!');
    } catch (err) {
      console.error('Failed to save changes:', err);
      alert('Ошибка при сохранении изменений');
    }
  };

  const toggleEdit = (productId) => {
    setEditingProduct(editingProduct === productId ? null : productId);
  };

  return (
    <div className="admin-page">
      <div className="container">
        <h1>Админ панель</h1>
        
        <div className="admin-actions">
          <div className="category-selector">
            <label>Категория нового товара:</label>
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="category-select"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <button onClick={addProduct} className="add-product-btn">
            Добавить товар
          </button>
          <button onClick={saveChanges} className="save-btn">
            Сохранить изменения
          </button>
        </div>

        <div className="products-admin">
          {products.map(product => (
            <div key={product.id} className="admin-product-card">
              <div className="admin-product-header">
                <h3>{product.name}</h3>
                <div className="admin-product-actions">
                  <button 
                    onClick={() => toggleEdit(product.id)}
                    className="edit-btn"
                  >
                    {editingProduct === product.id ? 'Закрыть' : 'Редактировать'}
                  </button>
                  <button 
                    onClick={() => deleteProductHandler(product.id)}
                    className="delete-btn"
                  >
                    Удалить
                  </button>
                </div>
              </div>

              {editingProduct === product.id ? (
                <div className="admin-product-edit">
                  <div className="edit-field">
                    <label>Название:</label>
                    <input
                      type="text"
                      value={product.name}
                      onChange={(e) => handleProductChange(product.id, 'name', e.target.value)}
                    />
                  </div>

                  <div className="edit-field">
                    <label>Цена (BYN):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={product.price}
                      onChange={(e) => handleProductChange(product.id, 'price', parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="edit-field">
                    <label>Описание:</label>
                    <textarea
                      value={product.description}
                      onChange={(e) => handleProductChange(product.id, 'description', e.target.value)}
                    />
                  </div>

                  <div className="edit-field">
                    <label>В наличии:</label>
                    <input
                      type="checkbox"
                      checked={product.in_stock}
                      onChange={(e) => handleProductChange(product.id, 'in_stock', e.target.checked)}
                    />
                  </div>

                  <div className="edit-field">
                    <label>Изображение:</label>
                    <div className="image-upload">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            handleImageUpload(product.id, file);
                          }
                        }}
                        disabled={uploadingImage === product.id}
                      />
                      {uploadingImage === product.id && (
                        <div className="uploading">Загрузка...</div>
                      )}
                    </div>
                  </div>

                  {console.log('Render product', product.id, { category: product.category, editingProduct, selectedCategory })}

                  {(product.category === 'liquids' || (editingProduct === product.id && selectedCategory === 'liquids') || (editingProduct === product.id && !product.category && selectedCategory === 'liquids')) && (
                    <div className="flavors-admin">
                      <h4>Вкусы и количество банок:</h4>
                      
                      {product.flavors && Object.entries(product.flavors).map(([flavor, stock]) => (
                        <div key={flavor} className="flavor-edit">
                          <span className="flavor-name">{flavor}</span>
                          <input
                            type="number"
                            min="0"
                            value={stock}
                            onChange={(e) => handleFlavorChange(product.id, flavor, parseInt(e.target.value) || 0)}
                            className="flavor-stock-input"
                          />
                          <span>банок</span>
                        </div>
                      ))}

                      <div className="add-flavor">
                        <input
                          type="text"
                          placeholder="Новый вкус"
                          value={newFlavorInputs[product.id]?.name || ''}
                          onChange={(e) => updateNewFlavorInput(product.id, 'name', e.target.value)}
                        />
                        <input
                          type="number"
                          min="1"
                          value={newFlavorInputs[product.id]?.stock || 1}
                          onChange={(e) => updateNewFlavorInput(product.id, 'stock', e.target.value)}
                          placeholder="Кол-во"
                        />
                        <button onClick={() => addFlavor(product.id)}>
                          Добавить вкус
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="admin-product-info">
                  <div className="product-image-preview">
                    <img 
                      src={product.image} 
                      alt={product.name}
                      onError={(e) => {
                        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjBGMEYwIi8+CjxwYXRoIGQ9Ik04MCA2MEgxMjBWODBIMTBWMTIwSDgwVjE2MEgxMjBWMTIwSDE5MFY4MEgxMjBWNjBaIiBmaWxsPSIjREREIi8+Cjwvc3ZnPgo=';
                      }}
                    />
                  </div>
                  
                  <p><strong>Цена:</strong> {product.price} BYN</p>
                  <p><strong>Описание:</strong> {product.description}</p>
                  <p><strong>В наличии:</strong> {product.in_stock ? 'Да' : 'Нет'}</p>
                  
                  {product.category === 'liquids' && product.flavors && (
                    <div className="flavors-info">
                      <strong>Вкусы:</strong>
                      <ul>
                        {Object.entries(product.flavors).map(([flavor, stock]) => (
                          <li key={flavor}>{flavor}: {stock} банок</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
