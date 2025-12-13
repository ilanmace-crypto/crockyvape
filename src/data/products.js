import { getProducts as fetchProducts, createProduct as addProduct, updateProduct as modifyProduct, deleteProduct as removeProduct } from '../services/apiService';

export const categories = [
  { id: 'liquids', name: 'Жидкости', description: 'Жидкости для вейпинга' },
  { id: 'cartridges', name: 'Картриджи', description: 'Сменные картриджи' },
  { id: 'disposable', name: 'Одноразовые', description: 'Одноразовые вейпы' }
];

// Временные тестовые товары для демонстрации
const mockProducts = [
  {
    id: 1,
    name: 'Paradise Liquid Gold',
    description: 'Премиум жидкость с золотым вкусом ананаса и манго',
    price: 29.99,
    category: 'liquids',
    category_name: 'Жидкости',
    image: 'https://via.placeholder.com/300x200/9d4edd/ffffff?text=Paradise+Gold',
    flavors: {
      'Ананас': 15,
      'Манго': 12,
      'Золотой ананас': 8
    }
  },
  {
    id: 2,
    name: 'Vape Storm Pro',
    description: 'Мощный одноразовый вейп на 3000 затяжек',
    price: 49.99,
    category: 'disposable',
    category_name: 'Одноразовые',
    image: 'https://via.placeholder.com/300x200/5a189a/ffffff?text=Vape+Storm'
  },
  {
    id: 3,
    name: 'Cloud Cartridge X',
    description: 'Сменный картридж для POD систем',
    price: 19.99,
    category: 'cartridges',
    category_name: 'Картриджи',
    image: 'https://via.placeholder.com/300x200/ff0a78/ffffff?text=Cloud+X'
  },
  {
    id: 4,
    name: 'Paradise Berry Mix',
    description: 'Смесь лесных ягод с холодком',
    price: 27.99,
    category: 'liquids',
    category_name: 'Жидкости',
    image: 'https://via.placeholder.com/300x200/9d4edd/ffffff?text=Berry+Mix',
    flavors: {
      'Клубника': 20,
      'Черника': 18,
      'Малина': 10
    }
  },
  {
    id: 5,
    name: 'Thunder Disposable',
    description: 'Компактный одноразовый вейп 1500 затяжек',
    price: 34.99,
    category: 'disposable',
    category_name: 'Одноразовые',
    image: 'https://via.placeholder.com/300x200/5a189a/ffffff?text=Thunder'
  },
  {
    id: 6,
    name: 'Premium Pod Kit',
    description: 'Набор POD систем с двумя картриджами',
    price: 89.99,
    category: 'cartridges',
    category_name: 'Картриджи',
    image: 'https://via.placeholder.com/300x200/ff0a78/ffffff?text=Premium+Kit'
  }
];

// Загрузка всех товаров из API
export const getProducts = async () => {
  try {
    // Сначала пробуем загрузить из API
    const data = await fetchProducts();
    return data.map(product => {
      // Map backend category_name to frontend category id
      const matchedCategory = categories.find(
        (cat) => cat.name === product.category_name
      );

      let flavorsParsed = {};
      try {
        flavorsParsed = product.flavors ? JSON.parse(product.flavors) : {};
      } catch (_) {
        // If already object, keep as is
        flavorsParsed = typeof product.flavors === 'object' && product.flavors !== null
          ? product.flavors
          : {};
      }

      // Если категория не проставлена на бэке, но есть вкусы,
      // считаем товар жидкостью, чтобы работал выбор вкуса.
      const hasFlavors = flavorsParsed && Object.keys(flavorsParsed).length > 0;
      const mappedCategory = matchedCategory
        ? matchedCategory.id
        : (product.category || (hasFlavors ? 'liquids' : null));

      return {
        ...product,
        category: mappedCategory,
        flavors: flavorsParsed,
      };
    });
  } catch (error) {
    console.warn('API недоступен, используем тестовые данные:', error);
    // Если API недоступен, возвращаем тестовые товары
    return mockProducts;
  }
};

// Создание нового товара
export const createProduct = async (product) => {
  try {
    const data = await addProduct(product);
    const matchedCategory = categories.find(
      (cat) => cat.name === data.category_name
    );
    let flavorsParsed = {};
    try {
      flavorsParsed = data.flavors ? JSON.parse(data.flavors) : {};
    } catch (_) {
      flavorsParsed = typeof data.flavors === 'object' && data.flavors !== null ? data.flavors : {};
    }
    return {
      ...data,
      category: matchedCategory ? matchedCategory.id : (data.category || null),
      flavors: flavorsParsed,
    };
  } catch (error) {
    console.error('Error creating product in API:', error);
    throw error;
  }
};

// Обновление товара
export const updateProduct = async (id, updates) => {
  try {
    const data = await modifyProduct(id, updates);
    const matchedCategory = categories.find(
      (cat) => cat.name === data.category_name
    );
    let flavorsParsed = {};
    try {
      flavorsParsed = data.flavors ? JSON.parse(data.flavors) : {};
    } catch (_) {
      flavorsParsed = typeof data.flavors === 'object' && data.flavors !== null ? data.flavors : {};
    }
    return {
      ...data,
      category: matchedCategory ? matchedCategory.id : (data.category || null),
      flavors: flavorsParsed,
    };
  } catch (error) {
    console.error('Error updating product in API:', error);
    throw error;
  }
};

// Удаление товара
export const deleteProduct = async (id) => {
  try {
    await removeProduct(id);
  } catch (error) {
    console.error('Error deleting product in API:', error);
    throw error;
  }
};
