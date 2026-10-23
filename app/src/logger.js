const fs = require('fs');
const path = require('path');

// Đường dẫn file log dùng chung cho Promtail
const LOG_DIR = process.env.LOG_DIR || '/var/log/app';
const LOG_FILE = path.join(LOG_DIR, 'app.log');

// Khởi tạo thư mục log nếu chưa tồn tại
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
} catch (err) {
  console.warn(`[WARN] Không thể tạo thư mục log ${LOG_DIR}, ghi log ra console:`, err.message);
}

function writeLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...meta
  };

  const logLine = JSON.stringify(logEntry);

  // In ra stdout để Docker logs bắt được
  if (level === 'ERROR') {
    console.error(`[${timestamp}] [${level}] ${message}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
  } else {
    console.log(`[${timestamp}] [${level}] ${message}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
  }

  // Ghi vào file để Promtail thu thập đưa lên Grafana Loki
  try {
    fs.appendFileSync(LOG_FILE, logLine + '\n', 'utf8');
  } catch (e) {
    // Không làm sập ứng dụng nếu file log bận
  }
}

module.exports = {
  info: (msg, meta) => writeLog('INFO', msg, meta),
  warn: (msg, meta) => writeLog('WARN', msg, meta),
  error: (msg, meta) => writeLog('ERROR', msg, meta),
  order: (msg, meta) => writeLog('ORDER', msg, meta)
};
