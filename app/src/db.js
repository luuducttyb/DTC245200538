const { Pool } = require('pg');
const logger = require('./logger');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'restaurant_db',
  user: process.env.POSTGRES_USER || 'resta_admin',
  password: process.env.POSTGRES_PASSWORD || '***REMOVED***',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Lỗi không mong muốn trong Connection Pool của PostgreSQL:', { error: err.message });
});

// Hàm kiểm tra và thử lại kết nối khi khởi động container
async function waitForDatabase(retries = 15, delay = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      const client = await pool.connect();
      logger.info(`[DB] Kết nối thành công đến PostgreSQL tại lần thử thứ ${i}!`);
      client.release();
      return true;
    } catch (err) {
      logger.warn(`[DB] Đang đợi PostgreSQL sẵn sàng (Lần thử ${i}/${retries})...: ${err.message}`);
      if (i === retries) {
        throw new Error(`Không thể kết nối đến cơ sở dữ liệu sau ${retries} lần thử: ${err.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Khởi tạo bảng nếu cần (đảm bảo dữ liệu luôn đầy đủ)
async function ensureTablesAndSeed() {
  const checkTableQuery = `
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'tables'
    );
  `;
  try {
    const res = await pool.query(checkTableQuery);
    if (!res.rows[0].exists) {
      logger.info('[DB] Bảng chưa tồn tại, bắt đầu tự động tạo schema và dữ liệu mẫu...');
      const fs = require('fs');
      const path = require('path');
      const sqlPath = path.join(__dirname, '../../db/init.sql');
      if (fs.existsSync(sqlPath)) {
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await pool.query(sql);
        logger.info('[DB] Đã khởi tạo schema và nạp dữ liệu mẫu thành công!');
      }
    } else {
      logger.info('[DB] Cơ sở dữ liệu đã sẵn sàng với đầy đủ bảng và dữ liệu.');
    }
  } catch (err) {
    logger.error('[DB] Lỗi kiểm tra / khởi tạo bảng:', { error: err.message });
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  waitForDatabase,
  ensureTablesAndSeed
};
