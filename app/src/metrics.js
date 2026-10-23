const client = require('prom-client');

// Khởi tạo Registry để gom toàn bộ metrics
const register = new client.Registry();

// Thu thập metrics mặc định của Node.js (CPU, Memory, Event Loop, v.v.)
client.collectDefaultMetrics({ register, prefix: 'nodejs_' });

// 1. Đếm tổng số lượt request HTTP
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Tổng số lượt HTTP request đến hệ thống',
  labelNames: ['method', 'route', 'status_code']
});
register.registerMetric(httpRequestsTotal);

// 2. Đo thời gian phản hồi của request HTTP
const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Thời gian xử lý HTTP request tính bằng giây',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5]
});
register.registerMetric(httpRequestDurationSeconds);

// 3. Đếm số đơn hàng theo trạng thái
const restaurantOrdersTotal = new client.Counter({
  name: 'restaurant_orders_total',
  help: 'Tổng số đơn hàng được tạo hoặc cập nhật trạng thái',
  labelNames: ['status']
});
register.registerMetric(restaurantOrdersTotal);

// 4. Doanh thu tích lũy từ các đơn đã thanh toán
const restaurantRevenueTotal = new client.Counter({
  name: 'restaurant_revenue_total',
  help: 'Tổng doanh thu nhà hàng thu được (VNĐ)'
});
register.registerMetric(restaurantRevenueTotal);

// 5. Số bàn đang có khách hiện tại
const restaurantActiveTables = new client.Gauge({
  name: 'restaurant_active_tables',
  help: 'Số lượng bàn ăn đang có khách ngồi'
});
register.registerMetric(restaurantActiveTables);

module.exports = {
  register,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  restaurantOrdersTotal,
  restaurantRevenueTotal,
  restaurantActiveTables
};
