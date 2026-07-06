-- Wholesale Cool Drinks Distribution Management System Database Schema (PostgreSQL)

-- 1. Users Table
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'salesman', 'delivery')),
    name VARCHAR(100) NOT NULL,
    mobile VARCHAR(15),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Routes Table
CREATE TABLE routes (
    id VARCHAR(50) PRIMARY KEY,
    name_en VARCHAR(100) NOT NULL,
    name_ta VARCHAR(100) NOT NULL,
    salesman_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    delivery_man_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Shops Table
CREATE TABLE shops (
    id VARCHAR(50) PRIMARY KEY,
    name_en VARCHAR(150) NOT NULL,
    name_ta VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100),
    mobile VARCHAR(15) NOT NULL,
    gst_number VARCHAR(15),
    address TEXT NOT NULL,
    shop_type VARCHAR(20) NOT NULL CHECK (shop_type IN ('wholesale', 'retail')),
    route_id VARCHAR(50) REFERENCES routes(id) ON DELETE RESTRICT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    outstanding_amount NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Products Table
CREATE TABLE products (
    id VARCHAR(50) PRIMARY KEY,
    name_en VARCHAR(150) NOT NULL,
    name_ta VARCHAR(150) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    size VARCHAR(20) NOT NULL,
    case_qty_rule INT NOT NULL CHECK (case_qty_rule > 0),
    purchase_price NUMERIC(10, 2) NOT NULL CHECK (purchase_price >= 0),
    wholesale_price NUMERIC(10, 2) NOT NULL CHECK (wholesale_price >= 0),
    retail_price NUMERIC(10, 2) NOT NULL CHECK (retail_price >= 0),
    current_stock_bottles INT DEFAULT 0 CHECK (current_stock_bottles >= 0),
    min_stock INT DEFAULT 0 CHECK (min_stock >= 0),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Purchases Table
CREATE TABLE purchases (
    id VARCHAR(50) PRIMARY KEY,
    supplier VARCHAR(150) NOT NULL,
    purchase_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    product_id VARCHAR(50) REFERENCES products(id) ON DELETE CASCADE,
    cases INT DEFAULT 0 CHECK (cases >= 0),
    bottles INT DEFAULT 0 CHECK (bottles >= 0),
    purchase_price NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Stock Ledger Table
CREATE TABLE stock_ledger (
    id VARCHAR(50) PRIMARY KEY,
    product_id VARCHAR(50) REFERENCES products(id) ON DELETE CASCADE,
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('opening', 'purchase', 'sale', 'refill')),
    cases_change INT DEFAULT 0,
    bottles_change INT DEFAULT 0,
    running_stock_bottles INT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Orders Table
CREATE TABLE orders (
    id VARCHAR(50) PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    route_id VARCHAR(50) REFERENCES routes(id) ON DELETE RESTRICT,
    shop_id VARCHAR(50) REFERENCES shops(id) ON DELETE RESTRICT,
    salesman_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_amount NUMERIC(12, 2) NOT NULL,
    discount NUMERIC(10, 2) DEFAULT 0.00,
    net_amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'cancelled')),
    delivery_man_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL
);

-- 8. Order Items Table
CREATE TABLE order_items (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50) REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(50) REFERENCES products(id) ON DELETE RESTRICT,
    cases INT DEFAULT 0,
    bottles INT DEFAULT 0,
    rate NUMERIC(10, 2) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL
);

-- 9. Deliveries Table
CREATE TABLE deliveries (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50) REFERENCES orders(id) ON DELETE CASCADE,
    delivery_man_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'delivered')),
    delivery_time TIMESTAMP WITH TIME ZONE,
    remarks TEXT
);

-- 10. Payments Table
CREATE TABLE payments (
    id VARCHAR(50) PRIMARY KEY,
    shop_id VARCHAR(50) REFERENCES shops(id) ON DELETE RESTRICT,
    order_id VARCHAR(50) REFERENCES orders(id) ON DELETE SET NULL,
    collected_amount NUMERIC(12, 2) NOT NULL CHECK (collected_amount > 0),
    payment_mode VARCHAR(20) NOT NULL CHECK (payment_mode IN ('cash', 'gpay', 'bank')),
    transaction_number VARCHAR(100),
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Outstanding History Table
CREATE TABLE outstanding_history (
    id VARCHAR(50) PRIMARY KEY,
    shop_id VARCHAR(50) REFERENCES shops(id) ON DELETE CASCADE,
    change_amount NUMERIC(12, 2) NOT NULL,
    balance_amount NUMERIC(12, 2) NOT NULL,
    description VARCHAR(255),
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Bills Table
CREATE TABLE bills (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50) REFERENCES orders(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) NOT NULL,
    pdf_path VARCHAR(255),
    shared_status VARCHAR(20) DEFAULT 'none' CHECK (shared_status IN ('none', 'shared')),
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Notifications Table
CREATE TABLE notifications (
    id VARCHAR(50) PRIMARY KEY,
    type VARCHAR(30) NOT NULL CHECK (type IN ('low_stock', 'out_of_stock', 'stock_refilled', 'pending_delivery', 'pending_collection')),
    message_en TEXT NOT NULL,
    message_ta TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'unread' CHECK (status IN ('unread', 'read')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. Performance Indexes
CREATE INDEX idx_shops_route ON shops(route_id);
CREATE INDEX idx_orders_shop ON orders(shop_id);
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_ledger_product ON stock_ledger(product_id);
CREATE INDEX idx_notifications_status ON notifications(status);

-- 15. Real-Time Transaction Safety Trigger (Prevent Overbooking)
-- In a database, transactional safety is enforced by blocking reads on row locks:
-- SELECT current_stock_bottles FROM products WHERE id = $1 FOR UPDATE;
-- Followed by checks:
-- IF current_stock_bottles < requested_qty THEN ROLLBACK;
