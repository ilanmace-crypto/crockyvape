import React, { useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';
import { useUser } from '../context/UserContext';
import { createOrder } from '../services/apiService';
import './CartPage.css';

const CartPage = () => {
  const { cartItems, removeFromCart, updateQuantity, getTotalPrice, clearCart, checkout } = useCart();
  const { currentUser, ensureUserWithTelegram } = useUser();
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    telegramUsername: '',
    paymentMethod: 'cash'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (currentUser?.telegramUsername) {
      setCustomerInfo((prev) => ({
        ...prev,
        telegramUsername: currentUser.telegramUsername,
      }));
    }
  }, [currentUser]);

  const handleRemove = (productId, flavor) => {
    removeFromCart(productId, flavor);
  };

  const handleQuantityChange = (productId, quantity, flavor) => {
    updateQuantity(productId, quantity, flavor);
  };

  const handleCheckout = () => {
    setShowCheckoutModal(true);
  };

  const handleConfirmCheckout = async () => {
    const raw = customerInfo.telegramUsername.trim();
    if (!raw) {
      alert('Пожалуйста, введите ваш юзернейм Telegram');
      return;
    }

    // Гарантируем, что под этим юзером есть аккаунт
    const normalized = raw.startsWith('@') ? raw.slice(1) : raw;
    const savedUser = ensureUserWithTelegram(normalized);

    try {
      setIsSubmitting(true);

      // Создаём заказ на бэкенде (минимальные данные)
      await createOrder({
        customer_name: normalized,
        customer_email: '',
        customer_phone: '',
        items: cartItems,
        total_amount: getTotalPrice(),
      });

      // Локальная логика: уведомление в Telegram, история заказов + очистка корзины
      await checkout({
        ...customerInfo,
        telegramUsername: normalized,
        userId: savedUser?.id || null,
      });

      setShowCheckoutModal(false);
      setCustomerInfo({ telegramUsername: savedUser?.telegramUsername || normalized, paymentMethod: 'cash' });
      setSuccessMessage('Спасибо за заказ! Мы свяжемся с вами в ближайшее время.');
    } catch (error) {
      console.error('Ошибка при оформлении заказа из корзины:', error);
      alert('Произошла ошибка при оформлении заказа. Попробуйте ещё раз.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelCheckout = () => {
    setShowCheckoutModal(false);
    setCustomerInfo({ telegramUsername: '', paymentMethod: 'cash' });
  };

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  if (cartItems.length === 0) {
    if (successMessage) {
      return (
        <div className="cart-page">
          <div className="container">
            <h1>Спасибо за заказ</h1>
            <p>{successMessage}</p>
          </div>
        </div>
      );
    }
    return (
      <div className="cart-page">
        <div className="container">
          <h1>Корзина</h1>
          <p>Ваша корзина пуста</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="container">
        <h1>Корзина</h1>
        
        <div className="cart-items">
          {cartItems.map(item => (
            <div key={`${item.id}-${item.flavor || 'no-flavor'}`} className="cart-item">
              <div className="item-info">
                <h3>{item.name}</h3>
                {item.flavor && (
                  <p className="item-flavor">Вкус: {item.flavor}</p>
                )}
                <p className="item-price">{item.price} BYN</p>
              </div>
              
              <div className="item-quantity">
                <button 
                  onClick={() => handleQuantityChange(item.id, item.quantity - 1, item.flavor)}
                  className="quantity-btn"
                >
                  -
                </button>
                <span className="quantity">{item.quantity}</span>
                <button 
                  onClick={() => handleQuantityChange(item.id, item.quantity + 1, item.flavor)}
                  className="quantity-btn"
                >
                  +
                </button>
              </div>
              
              <div className="item-total">
                {(item.price * item.quantity).toFixed(2)} BYN
              </div>
              
              <button 
                onClick={() => handleRemove(item.id, item.flavor)}
                className="remove-btn"
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
        
        <div className="cart-summary">
          <div className="summary-row">
            <span>Всего товаров:</span>
            <span>{getTotalItems()} шт.</span>
          </div>
          <div className="summary-row total">
            <span>Итого:</span>
            <span>{getTotalPrice().toFixed(2)} BYN</span>
          </div>
          
          <div className="cart-actions">
            <button onClick={clearCart} className="clear-cart-btn">
              Очистить корзину
            </button>
            <button onClick={handleCheckout} className="checkout-btn">
              Оформить заказ
            </button>
          </div>
        </div>
      </div>
      
      {/* Модальное окно оформления заказа */}
      {showCheckoutModal && (
        <div className="checkout-modal">
          <div className="modal-content">
            <h2>Оформление заказа</h2>
            
            <div className="form-group">
              <label htmlFor="telegramUsername">Ваш юзернейм Telegram:</label>
              <input
                type="text"
                id="telegramUsername"
                value={customerInfo.telegramUsername}
                onChange={(e) => setCustomerInfo({...customerInfo, telegramUsername: e.target.value})}
                placeholder="@username"
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label>Способ оплаты:</label>
              <div className="payment-methods">
                <label className="payment-option">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cash"
                    checked={customerInfo.paymentMethod === 'cash'}
                    onChange={(e) => setCustomerInfo({...customerInfo, paymentMethod: e.target.value})}
                  />
                  Наличные
                </label>
                <label className="payment-option">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="card"
                    checked={customerInfo.paymentMethod === 'card'}
                    onChange={(e) => setCustomerInfo({...customerInfo, paymentMethod: e.target.value})}
                  />
                  Карта
                </label>
              </div>
            </div>
            
            <div className="modal-actions">
              <button onClick={handleCancelCheckout} className="cancel-btn" disabled={isSubmitting}>
                Отмена
              </button>
              <button onClick={handleConfirmCheckout} className="confirm-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Оформление...' : 'Подтвердить заказ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
