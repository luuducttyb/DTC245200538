-- =========================================================
-- Đề 12: Hệ Thống Quản Lý Nhà Hàng / Order
-- File khởi tạo cơ sở dữ liệu PostgreSQL (init.sql)
-- =========================================================

-- 1. Bảng Bàn ăn (tables)
CREATE TABLE IF NOT EXISTS tables (
    id SERIAL PRIMARY KEY,
    table_number INT UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    capacity INT DEFAULT 4,
    status VARCHAR(20) DEFAULT 'TRONG' CHECK (status IN ('TRONG', 'CO_KHACH')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng Món ăn (dishes)
CREATE TABLE IF NOT EXISTS dishes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    status VARCHAR(20) DEFAULT 'CON_HANG' CHECK (status IN ('CON_HANG', 'HET_HANG')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bảng Đơn hàng (orders)
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_code VARCHAR(32) UNIQUE NOT NULL,
    table_id INT REFERENCES tables(id) ON DELETE SET NULL,
    total_amount NUMERIC(12, 2) DEFAULT 0 CHECK (total_amount >= 0),
    status VARCHAR(30) DEFAULT 'CHO_XU_LY' CHECK (status IN ('CHO_XU_LY', 'DANG_CHUAN_BI', 'DA_PHUC_VU', 'DA_THANH_TOAN', 'DA_HUY')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Bảng Chi tiết món của đơn hàng (order_items)
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    dish_id INT NOT NULL REFERENCES dishes(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0)
);

-- Chỉ mục tối ưu truy vấn
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_dishes_category ON dishes(category);

-- =========================================================
-- DỮ LIỆU MẪU (SEED DATA)
-- =========================================================

-- Dữ liệu 10 bàn ăn
INSERT INTO tables (table_number, name, capacity, status) VALUES
(1, 'Bàn 01', 4, 'TRONG'),
(2, 'Bàn 02', 4, 'CO_KHACH'),
(3, 'Bàn 03', 2, 'TRONG'),
(4, 'Bàn 04', 4, 'TRONG'),
(5, 'Bàn 05', 6, 'CO_KHACH'),
(6, 'Bàn 06', 4, 'TRONG'),
(7, 'Bàn 07', 4, 'TRONG'),
(8, 'Bàn 08', 2, 'TRONG'),
(9, 'Bàn VIP 01', 8, 'TRONG'),
(10, 'Bàn VIP 02', 12, 'TRONG')
ON CONFLICT (table_number) DO NOTHING;

-- Dữ liệu 12 món ăn đặc sắc
INSERT INTO dishes (name, category, price, status, description) VALUES
('Phở Bò Đặc Biệt', 'Món chính', 65000, 'CON_HANG', 'Bánh phở tươi, thịt bò tái lăn, nạm, gầu và nước dùng xương hầm 12h'),
('Bún Chả Hà Nội', 'Món chính', 55000, 'CON_HANG', 'Chả nướng than hoa thơm lừng kèm nem rán và rau sống tươi ngon'),
('Cơm Tấm Sườn Bì Chả', 'Món chính', 60000, 'CON_HANG', 'Sườn cốt lết nướng mật ong, bì thơm giòn, chả trứng hấp'),
('Bò Lúc Lắc Khoai Tây', 'Món chính', 125000, 'CON_HANG', 'Thịt bò thăn mềm xào tiêu đen ăn kèm khoai tây chiên giòn'),
('Gỏi Cuốn Tôm Thịt (4 cuốn)', 'Khai vị', 45000, 'CON_HANG', 'Tôm tươi, thịt luộc cuộn cùng bánh tráng, chấm tương đen đậu phộng'),
('Nem Rán Hải Sản Giòn Rụm', 'Khai vị', 50000, 'CON_HANG', 'Nhân tôm cua tươi bọc bánh đa nem giòn rụm chấm nước mắm chua ngọt'),
('Khoai Tây Chiên Bơ Tỏi', 'Khai vị', 35000, 'CON_HANG', 'Khoai tây vàng giòn lắc bơ tỏi thơm ngậy'),
('Trà Đào Cam Sả', 'Đồ uống', 35000, 'CON_HANG', 'Hương đào thơm mát kết hợp vị chua thanh của cam và sả tươi'),
('Cà Phê Sữa Đá Sài Gòn', 'Đồ uống', 28000, 'CON_HANG', 'Cà phê Robusta đậm đà pha phin truyền thống kèm sữa đặc'),
('Nước Ép Dưa Hấu Tươi', 'Đồ uống', 32000, 'CON_HANG', 'Dưa hấu tươi nguyên chất 100%, thanh nhiệt giải khát'),
('Chè Hạt Sen Long Nhãn', 'Tráng miệng', 30000, 'CON_HANG', 'Hạt sen bùi thơm ôm cùi nhãn ngọt thanh, nước đường phèn thanh mát'),
('Kem Dừa Côn Đảo', 'Tráng miệng', 35000, 'CON_HANG', 'Kem dừa béo ngậy kèm dừa nạo sấy và đậu phộng rang giòn')
ON CONFLICT DO NOTHING;

-- Dữ liệu đơn hàng mẫu đang hoạt động
-- Đơn hàng 1: Bàn 02 (đang chuẩn bị món)
INSERT INTO orders (id, order_code, table_id, total_amount, status, notes, created_at)
VALUES (1, 'ORD-20261022-001', 2, 165000, 'DANG_CHUAN_BI', 'Khách dặn phở ít hành, nhiều giá', CURRENT_TIMESTAMP - INTERVAL '25 minutes')
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (order_id, dish_id, quantity, unit_price, subtotal) VALUES
(1, 1, 2, 65000, 130000), -- 2 Phở bò đặc biệt
(1, 8, 1, 35000, 35000)   -- 1 Trà đào cam sả
ON CONFLICT DO NOTHING;

-- Đơn hàng 2: Bàn 05 (đã phục vụ, chờ thanh toán)
INSERT INTO orders (id, order_code, table_id, total_amount, status, notes, created_at)
VALUES (2, 'ORD-20261022-002', 5, 235000, 'DA_PHUC_VU', 'Khách VIP nhóm bạn', CURRENT_TIMESTAMP - INTERVAL '40 minutes')
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (order_id, dish_id, quantity, unit_price, subtotal) VALUES
(2, 4, 1, 125000, 125000), -- 1 Bò lúc lắc
(2, 6, 1, 50000, 50000),   -- 1 Nem rán hải sản
(2, 9, 1, 28000, 28000),   -- 1 Cà phê sữa đá
(2, 10, 1, 32000, 32000)   -- 1 Nước ép dưa hấu
ON CONFLICT DO NOTHING;

-- Đặt lại giá trị Sequence cho các bảng
SELECT setval('tables_id_seq', (SELECT COALESCE(MAX(id), 1) FROM tables));
SELECT setval('dishes_id_seq', (SELECT COALESCE(MAX(id), 1) FROM dishes));
SELECT setval('orders_id_seq', (SELECT COALESCE(MAX(id), 1) FROM orders));
SELECT setval('order_items_id_seq', (SELECT COALESCE(MAX(id), 1) FROM order_items));
