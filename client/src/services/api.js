const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  // Получение товаров
  static async getProducts() {
    try {
      const response = await fetch(`${API_BASE}/products`);
      if (!response.ok) throw new Error('Failed to fetch products');
      return await response.json();
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  }

  // Получение категорий
  static async getCategories() {
    try {
      const response = await fetch(`${API_BASE}/categories`);
      if (!response.ok) throw new Error('Failed to fetch categories');
      return await response.json();
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  }

  // Создание/обновление пользователя Telegram
  static async saveTelegramUser(userData) {
    try {
      const response = await fetch(`${API_BASE}/users/telegram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      if (!response.ok) throw new Error('Failed to save user');
      return await response.json();
    } catch (error) {
      console.error('Error saving user:', error);
      return null;
    }
  }

  // Создание заказа
  static async createOrder(orderData) {
    try {
      const response = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });
      if (!response.ok) throw new Error('Failed to create order');
      return await response.json();
    } catch (error) {
      console.error('Error creating order:', error);
      return null;
    }
  }

  // Получение отзывов
  static async getReviews() {
    try {
      const response = await fetch(`${API_BASE}/reviews`);
      if (!response.ok) throw new Error('Failed to fetch reviews');
      return await response.json();
    } catch (error) {
      console.error('Error fetching reviews:', error);
      return [];
    }
  }

  // Создание отзыва
  static async createReview(reviewData) {
    try {
      const response = await fetch(`${API_BASE}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reviewData),
      });
      if (!response.ok) throw new Error('Failed to create review');
      return await response.json();
    } catch (error) {
      console.error('Error creating review:', error);
      return null;
    }
  }

  // Получение заказов пользователя
  static async getUserOrders(telegramId) {
    try {
      const response = await fetch(`${API_BASE}/orders/user/${telegramId}`);
      if (!response.ok) throw new Error('Failed to fetch user orders');
      return await response.json();
    } catch (error) {
      console.error('Error fetching user orders:', error);
      return [];
    }
  }
}

export default ApiService;
