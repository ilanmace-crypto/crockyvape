const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  // Получение товаров
  static async getProducts() {
    try {
      const response = await fetch(`${API_BASE}/products`);
      if (!response.ok) throw new Error('Failed to fetch products');
      const data = await response.json();
      return data.length > 0 ? data : this.getStaticProducts();
    } catch (error) {
      console.error('Error fetching products:', error);
      return this.getStaticProducts();
    }
  }

  // Статические товары для тестирования
  static getStaticProducts() {
    return [
      {
        id: 'liquid1',
        name: 'Клубничный Взрыв',
        category: 'liquids',
        price: 15.00,
        description: 'Сочный клубничный вкус с нотками свежести',
        image_url: null,
        stock: 50,
        is_active: true,
        flavors: [
          { flavor_name: 'Клубника', stock: 25 },
          { flavor_name: 'Клубника со сливками', stock: 25 }
        ]
      },
      {
        id: 'liquid2',
        name: 'Мятный Холод',
        category: 'liquids',
        price: 14.50,
        description: 'Освежающий мятный вкус для любителей холода',
        image_url: null,
        stock: 40,
        is_active: true,
        flavors: [
          { flavor_name: 'Мята', stock: 20 },
          { flavor_name: 'Мята с лимоном', stock: 20 }
        ]
      },
      {
        id: 'consumable1',
        name: 'Картридж для Pod',
        category: 'consumables',
        price: 8.00,
        description: 'Качественный картридж для вашего устройства',
        image_url: null,
        stock: 100,
        is_active: true,
        flavors: []
      },
      {
        id: 'consumable2',
        name: 'Аккумулятор 18650',
        category: 'consumables',
        price: 12.00,
        description: 'Мощный аккумулятор для ваших устройств',
        image_url: null,
        stock: 30,
        is_active: true,
        flavors: []
      }
    ];
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
      // Проверка интернет соединения
      if (!navigator.onLine) {
        throw new Error('Нет подключения к интернету');
      }

      const response = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
        timeout: 10000, // 10 секунд таймаут
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error creating order:', error);
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Ошибка сети. Проверь подключение к интернету.');
      }
      
      if (error.name === 'AbortError') {
        throw new Error('Превышено время ожидания. Попробуй еще раз.');
      }
      
      throw error;
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
