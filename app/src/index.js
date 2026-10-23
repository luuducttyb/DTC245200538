const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const logger = require('./logger');
const metrics = require('./metrics');

const app = express();
const PORT = process.env.APP_PORT || 3000;

app.use(cors());
app.use(express.json());

// Middleware đo đạc Prometheus Metrics & Log Request
app.use((req, res, next) => {
  const start = process.hrtime();
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const duration = diff[0] + diff[1] / 1e9;
    const route = req.route ? req.route.path : req.path;

    // Prometheus
    metrics.httpRequestsTotal.inc({
      method: req.method,
      route: route,
      status_code: res.statusCode
    });
    metrics.httpRequestDurationSeconds.observe({
      method: req.method,
      route: route,
      status_code: res.statusCode
    }, duration);

    // Logger (Bỏ qua log request định kỳ của /metrics để tránh ngập log)
    if (req.path !== '/metrics' && req.path !== '/health') {
      logger.info(`HTTP ${req.method} ${req.originalUrl} [${res.statusCode}] - ${(duration * 1000).toFixed(2)}ms`);
    }
  });
  next();
});

// Phục vụ file tĩnh giao diện web
app.use(express.static(path.join(__dirname, '../public')));

// ==========================================
// 1. HEALTHCHECK & PROMETHEUS METRICS
// ==========================================
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.status(200).json({ status: 'UP', database: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'DOWN', database: 'disconnected', error: err.message });
  }
});

app.get('/metrics', async (req, res) => {
  try {
    // Cập nhật số bàn đang có khách hiện tại vào Prometheus Gauge
    const activeTablesRes = await db.query("SELECT COUNT(*) FROM tables WHERE status = 'CO_KHACH'");
    const activeCount = parseInt(activeTablesRes.rows[0].count, 10) || 0;
    metrics.restaurantActiveTables.set(activeCount);

    res.set('Content-Type', metrics.register.contentType);
    res.end(await metrics.register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

// ==========================================
// 2. API QUẢN LÝ BÀN ĂN (TABLES)
// ==========================================
app.get('/api/tables', async (req, res) => {
  try {
    const query = `
      SELECT t.*, 
        o.id as current_order_id, 
        o.order_code as current_order_code, 
        o.total_amount as current_order_total,
        o.status as current_order_status
      FROM tables t
      LEFT JOIN orders o ON t.id = o.table_id AND o.status NOT IN ('DA_THANH_TOAN', 'DA_HUY')
      ORDER BY t.table_number ASC;
    `;
    const result = await db.query(query);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('Lỗi lấy danh sách bàn ăn:', { error: err.message });
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách bàn ăn' });
  }
});

app.put('/api/tables/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['TRONG', 'CO_KHACH'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Trạng thái bàn không hợp lệ (TRONG hoặc CO_KHACH)' });
  }
  try {
    const result = await db.query(
      'UPDATE tables SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bàn ăn' });
    }
    logger.info(`Cập nhật trạng thái bàn #${id} thành ${status}`);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('Lỗi cập nhật trạng thái bàn:', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 3. API QUẢN LÝ MÓN ĂN (DISHES)
// ==========================================
app.get('/api/dishes', async (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM dishes';
    const params = [];
    if (category && category !== 'ALL') {
      query += ' WHERE category = $1';
      params.push(category);
    }
    query += ' ORDER BY category ASC, id ASC';
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('Lỗi lấy danh sách món ăn:', { error: err.message });
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy món ăn' });
  }
});

app.post('/api/dishes', async (req, res) => {
  const { name, category, price, status, description } = req.body;
  if (!name || !category || price === undefined || price < 0) {
    return res.status(400).json({ success: false, message: 'Tên, danh mục và giá món ăn không hợp lệ' });
  }
  try {
    const result = await db.query(
      `INSERT INTO dishes (name, category, price, status, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, category, price, status || 'CON_HANG', description || '']
    );
    logger.info(`Thêm món ăn mới: ${name} (${price}đ)`);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('Lỗi thêm món ăn mới:', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/dishes/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category, price, status, description } = req.body;
  try {
    const result = await db.query(
      `UPDATE dishes 
       SET name = COALESCE($1, name),
           category = COALESCE($2, category),
           price = COALESCE($3, price),
           status = COALESCE($4, status),
           description = COALESCE($5, description)
       WHERE id = $6 RETURNING *`,
      [name, category, price, status, description, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy món ăn' });
    }
    logger.info(`Cập nhật món ăn #${id}: ${result.rows[0].name}`);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('Lỗi cập nhật món ăn:', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/dishes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM dishes WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy món ăn để xóa' });
    }
    logger.info(`Đã xóa món ăn #${id}: ${result.rows[0].name}`);
    res.json({ success: true, message: 'Đã xóa món ăn thành công' });
  } catch (err) {
    if (err.code === '23503') { // Foreign key violation
      return res.status(400).json({ success: false, message: 'Không thể xóa món ăn đã có trong lịch sử đơn hàng. Hãy chuyển trạng thái thành HẾT HÀNG.' });
    }
    logger.error('Lỗi xóa món ăn:', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 4. API QUẢN LÝ ĐƠN HÀNG (ORDERS & ITEMS)
// ==========================================
app.get('/api/orders', async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT o.*, t.name as table_name, t.table_number,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'dish_id', oi.dish_id,
              'dish_name', d.name,
              'quantity', oi.quantity,
              'unit_price', oi.unit_price,
              'subtotal', oi.subtotal
            )
          ) FILTER (WHERE oi.id IS NOT NULL), '[]'
        ) as items
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN dishes d ON oi.dish_id = d.id
    `;
    const params = [];
    if (status && status !== 'ALL') {
      query += ' WHERE o.status = $1';
      params.push(status);
    }
    query += ' GROUP BY o.id, t.name, t.table_number ORDER BY o.id DESC;';

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('Lỗi lấy danh sách đơn hàng:', { error: err.message });
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy đơn hàng' });
  }
});

// TẠO ĐƠN HÀNG MỚI (Tự động tính tổng tiền và cập nhật trạng thái bàn)
app.post('/api/orders', async (req, res) => {
  const { table_id, notes, items } = req.body;

  if (!table_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Cần chọn bàn ăn và ít nhất 1 món ăn' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Kiểm tra bàn ăn
    const tableRes = await client.query('SELECT * FROM tables WHERE id = $1', [table_id]);
    if (tableRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Bàn ăn không tồn tại' });
    }
    const table = tableRes.rows[0];

    // 2. Lấy thông tin giá món ăn từ database để tính toán chính xác tuyệt đối
    const dishIds = items.map(i => i.dish_id);
    const dishesRes = await client.query('SELECT id, name, price, status FROM dishes WHERE id = ANY($1)', [dishIds]);
    const dishMap = new Map();
    dishesRes.rows.forEach(d => dishMap.set(d.id, d));

    let calculatedTotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const dish = dishMap.get(item.dish_id);
      if (!dish) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Món ăn ID ${item.dish_id} không tồn tại` });
      }
      if (dish.status === 'HET_HANG') {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Món [${dish.name}] hiện đã hết hàng` });
      }
      const qty = parseInt(item.quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Số lượng cho món [${dish.name}] không hợp lệ` });
      }

      const unitPrice = parseFloat(dish.price);
      const subtotal = unitPrice * qty;
      calculatedTotal += subtotal;

      validatedItems.push({
        dish_id: dish.id,
        quantity: qty,
        unit_price: unitPrice,
        subtotal: subtotal
      });
    }

    // 3. Tạo mã đơn hàng duy nhất
    const orderCode = `ORD-${Date.now().toString().slice(-6)}-${table.table_number}`;

    // 4. Lưu đơn hàng vào bảng orders
    const orderInsertQuery = `
      INSERT INTO orders (order_code, table_id, total_amount, status, notes)
      VALUES ($1, $2, $3, 'CHO_XU_LY', $4)
      RETURNING *;
    `;
    const orderRes = await client.query(orderInsertQuery, [orderCode, table_id, calculatedTotal, notes || '']);
    const newOrder = orderRes.rows[0];

    // 5. Lưu chi tiết món vào bảng order_items
    for (const vItem of validatedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, dish_id, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [newOrder.id, vItem.dish_id, vItem.quantity, vItem.unit_price, vItem.subtotal]
      );
    }

    // 6. Tự động chuyển bàn sang trạng thái 'CO_KHACH'
    await client.query("UPDATE tables SET status = 'CO_KHACH' WHERE id = $1", [table_id]);

    await client.query('COMMIT');

    // Cập nhật metrics Prometheus
    metrics.restaurantOrdersTotal.inc({ status: 'CHO_XU_LY' });

    // Log chi tiết sự kiện
    logger.order(`Tạo đơn hàng thành công [${orderCode}] cho ${table.name} - Tổng tiền: ${calculatedTotal.toLocaleString('vi-VN')}đ`, {
      order_id: newOrder.id,
      order_code: orderCode,
      table_id: table_id,
      total_amount: calculatedTotal,
      item_count: validatedItems.length
    });

    res.status(201).json({
      success: true,
      data: {
        ...newOrder,
        items: validatedItems
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Lỗi khi tạo đơn hàng mới:', { error: err.message });
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo đơn hàng' });
  } finally {
    client.release();
  }
});

// CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG (DANG_CHUAN_BI -> DA_PHUC_VU -> DA_THANH_TOAN / DA_HUY)
app.put('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const allowedStatuses = ['CHO_XU_LY', 'DANG_CHUAN_BI', 'DA_PHUC_VU', 'DA_THANH_TOAN', 'DA_HUY'];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Lấy thông tin đơn hàng hiện tại
    const currentRes = await client.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (currentRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }
    const currentOrder = currentRes.rows[0];

    // Cập nhật trạng thái
    const updateRes = await client.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );
    const updatedOrder = updateRes.rows[0];

    // Nếu đơn hàng thanh toán hoặc bị hủy -> giải phóng bàn về TRONG nếu không còn đơn nào khác
    if (['DA_THANH_TOAN', 'DA_HUY'].includes(status) && currentOrder.table_id) {
      const remainingOrdersRes = await client.query(
        "SELECT id FROM orders WHERE table_id = $1 AND status NOT IN ('DA_THANH_TOAN', 'DA_HUY') AND id != $2",
        [currentOrder.table_id, id]
      );
      if (remainingOrdersRes.rowCount === 0) {
        await client.query("UPDATE tables SET status = 'TRONG' WHERE id = $1", [currentOrder.table_id]);
      }
    }

    // Nếu thanh toán -> ghi nhận doanh thu vào Prometheus
    if (status === 'DA_THANH_TOAN' && currentOrder.status !== 'DA_THANH_TOAN') {
      const amount = parseFloat(updatedOrder.total_amount) || 0;
      metrics.restaurantRevenueTotal.inc(amount);
    }

    await client.query('COMMIT');

    // Metrics & Logging
    metrics.restaurantOrdersTotal.inc({ status: status });
    logger.order(`Cập nhật đơn hàng #${id} [${updatedOrder.order_code}] sang trạng thái: ${status}`, {
      order_id: updatedOrder.id,
      order_code: updatedOrder.order_code,
      new_status: status,
      total_amount: updatedOrder.total_amount
    });

    res.json({ success: true, data: updatedOrder });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Lỗi cập nhật trạng thái đơn hàng:', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 5. API THỐNG KÊ NHANH (STATS)
// ==========================================
app.get('/api/stats', async (req, res) => {
  try {
    const revenueRes = await db.query("SELECT COALESCE(SUM(total_amount), 0) as total_revenue FROM orders WHERE status = 'DA_THANH_TOAN'");
    const totalOrdersRes = await db.query("SELECT COUNT(*) as total_orders FROM orders");
    const activeOrdersRes = await db.query("SELECT COUNT(*) as active_orders FROM orders WHERE status NOT IN ('DA_THANH_TOAN', 'DA_HUY')");
    const tablesCountRes = await db.query("SELECT COUNT(*) filter (where status = 'CO_KHACH') as occupied, COUNT(*) as total FROM tables");
    const dishesCountRes = await db.query("SELECT COUNT(*) as total_dishes FROM dishes");

    res.json({
      success: true,
      data: {
        total_revenue: parseFloat(revenueRes.rows[0].total_revenue),
        total_orders: parseInt(totalOrdersRes.rows[0].total_orders, 10),
        active_orders: parseInt(activeOrdersRes.rows[0].active_orders, 10),
        tables_occupied: parseInt(tablesCountRes.rows[0].occupied, 10),
        tables_total: parseInt(tablesCountRes.rows[0].total, 10),
        total_dishes: parseInt(dishesCountRes.rows[0].total_dishes, 10)
      }
    });
  } catch (err) {
    logger.error('Lỗi lấy thống kê nhanh:', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
});

// Khởi động server sau khi kết nối Database sẵn sàng
async function startServer() {
  try {
    await db.waitForDatabase();
    await db.ensureTablesAndSeed();
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`[SERVER] Hệ thống Quản lý Nhà hàng đang chạy tại cổng ${PORT}`);
    });
  } catch (err) {
    logger.error(`[FATAL] Không thể khởi động ứng dụng:`, { error: err.message });
    process.exit(1);
  }
}

startServer();
