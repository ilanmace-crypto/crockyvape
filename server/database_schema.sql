-- Paradise Shop Database Schema
-- Compatible with MySQL/PostgreSQL (Neon.tech)

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    price DECIMAL(10,2) NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    stock INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product flavors table
CREATE TABLE IF NOT EXISTS product_flavors (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    flavor_name VARCHAR(100) NOT NULL,
    stock INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (product_id, flavor_name)
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id VARCHAR(100) UNIQUE NOT NULL,
    telegram_username VARCHAR(100),
    telegram_first_name VARCHAR(100),
    telegram_last_name VARCHAR(100),
    phone VARCHAR(20),
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    delivery_address TEXT,
    phone VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    flavor_name VARCHAR(100),
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id VARCHAR(50) REFERENCES products(id) ON DELETE SET NULL,
    rating INTEGER DEFAULT 5,
    review_text TEXT,
    telegram_username VARCHAR(100),
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admins table
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
);

-- Initial data
INSERT INTO categories (name, slug, description) VALUES 
    ('Жидкости', 'liquids', 'Жидкости для электронных сигарет'),
    ('Расходники', 'consumables', 'Картриджи, испарители и другие расходные материалы')
ON CONFLICT DO NOTHING;

INSERT INTO products (id, name, category_id, price, description, image_url, stock) VALUES 
    ('liq-1', 'PARADISE Liquid 30ml', 1, 25.00, 'Премиум жидкость 30мг/мл', NULL, 50),
    ('liq-2', 'Salt 20mg 30ml', 1, 28.00, 'Солевая никотиновая жидкость', NULL, 40),
    ('liq-3', 'Premium Mix 60ml', 1, 45.00, 'Большой флакон премиум жидкости', NULL, 30),
    ('con-1', 'Картридж (POD) 1.0Ω', 2, 12.00, 'Заменяемый картридж для POD систем', NULL, 100),
    ('con-2', 'Испаритель 0.6Ω', 2, 15.00, 'Коил для субомных систем', NULL, 80),
    ('con-3', 'Вата + проволока (сет)', 2, 18.00, 'Набор для самостоятельной намотки', NULL, 60),
    ('con-4', 'Сет картриджей (2шт)', 2, 20.00, 'Упаковка из 2 картриджей', NULL, 50)
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_flavors (product_id, flavor_name, stock) VALUES 
    ('liq-1', 'Mango Ice', 15),
    ('liq-1', 'Blueberry', 12),
    ('liq-1', 'Cola Lime', 10),
    ('liq-1', 'Grape', 8),
    ('liq-1', 'Strawberry Kiwi', 5),
    ('liq-2', 'Watermelon', 12),
    ('liq-2', 'Apple', 10),
    ('liq-2', 'Energy', 8),
    ('liq-2', 'Peach Ice', 10),
    ('liq-3', 'Vanilla Custard', 8),
    ('liq-3', 'Tobacco', 10),
    ('liq-3', 'Berry Mix', 12)
ON CONFLICT (product_id, flavor_name) DO NOTHING;

-- Admin user (password: admin123)
-- Note: Hash will be created by setup script
INSERT INTO admins (username, password_hash, role) VALUES 
    ('admin', '$2b$10$placeholder_hash_will_be_replaced', 'super_admin')
ON CONFLICT (username) DO NOTHING;
