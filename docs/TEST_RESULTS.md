# BẢNG KẾT QUẢ KIỂM THỬ THỰC TẾ (TEST RESULTS)
**Đề tài:** Đề 12 - Hệ Thống Quản Lý Nhà Hàng / Order  
**Thời gian kiểm chứng:** 22/10/2026  
**Môi trường thử nghiệm:** Windows 10 Pro, Docker Desktop (WSL2), Docker Compose v5.6.1  
**Quy tắc đánh giá:** Chỉ đánh dấu **PASS** khi đã thực thi lệnh kiểm chứng và có kết quả đầu ra thực tế. Không đánh dấu PASS chỉ vì container đang chạy.

---

## 1. TỔNG HỢP TRẠNG THÁI KIỂM THỬ

- **Tổng số hạng mục kiểm tra:** 15
- **Số hạng mục ĐẠT (PASS):** 15
- **Số hạng mục KHÔNG ĐẠT (FAIL):** 0
- **Số hạng mục BỊ CHẶN (BLOCKED):** 0

---

## 2. BẢNG CHI TIẾT KIỂM THỬ TỪNG HẠNG MỤC

| STT | Hạng mục kiểm tra | Lệnh / Thao tác kiểm chứng thực tế | Kết quả đầu ra thực tế | Trạng thái |
|:---:|:---|:---|:---|:---:|
| **1** | **Cú pháp Docker Compose** | `docker compose config` | Cú pháp hợp lệ, nạp đúng toàn bộ biến môi trường từ `.env`, Exit code: `0` | **PASS** |
| **2** | **Trạng thái 8 Containers** | `docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"` | 8/8 containers `Up`, `de12-postgres` đạt `healthy`, không có container restart | **PASS** |
| **3** | **Bảo mật Non-root Container** | `docker exec de12-app whoami` | Trả về `node` (UID 1000, không chạy quyền root) | **PASS** |
| **4** | **Phân tách mạng nội bộ** | `docker network inspect de12-nhahang_backend-net` | Thuộc tính `"Internal": true`. Chỉ có `postgres`, `app`, `pgadmin` kết nối | **PASS** |
| **5** | **Cô lập cổng PostgreSQL** | `netstat -ano \| findstr 5432` & `docker ps` | Cổng 5432 chỉ lắng nghe nội bộ trong container, **hoàn toàn không publish ra Host** | **PASS** |
| **6** | **Bảo mật file .env trong Git** | `git status --ignored` | File `.env` nằm trong danh sách `Ignored files`, không bị commit vào Git | **PASS** |
| **7** | **Lưu trữ CSDL PostgreSQL** | `docker exec de12-postgres psql -U resta_admin -d restaurant_db -c "SELECT ..."` | Có đầy đủ 4 bảng: `tables` (10), `dishes` (14), `orders` (4), `order_items` (9) | **PASS** |
| **8** | **Nginx Reverse Proxy & HTTP** | `curl.exe -i http://localhost:8080/health` | `HTTP/1.1 200 OK`, `Server: nginx` (ẩn version), JSON `status: "UP"` | **PASS** |
| **9** | **Nginx Security Headers** | Kiểm tra header từ phản hồi HTTP của Nginx | Đầy đủ: `X-Frame-Options: SAMEORIGIN`, `nosniff`, `XSS-Protection`, `Referrer-Policy` | **PASS** |
| **10** | **Nginx HTTPS Self-Signed** | `curl.exe -k -i https://localhost/health` | `HTTP/1.1 200 OK` qua cổng 443, có header `Strict-Transport-Security: max-age=31536000` | **PASS** |
| **11** | **Tạo đơn & Tính tiền tự động** | Gọi API `POST /api/orders` với 2 Phở bò (65k) + 1 Cà phê (28k) | Tạo đơn `ORD-866125-3`, tổng tiền đúng `158.000đ`, Bàn 03 chuyển sang `CO_KHACH` | **PASS** |
| **12** | **Cập nhật trạng thái đơn** | Gọi API `PUT /api/orders/3/status` sang `DA_THANH_TOAN` | Đơn cập nhật thành công, Bàn 03 **tự động giải phóng về trạng thái `TRONG`** | **PASS** |
| **13** | **Prometheus Thu thập Metrics** | `http://localhost:9090/api/v1/targets` & `http://localhost:8080/metrics` | Target `restaurant-app` báo `Health: UP`, metrics `restaurant_revenue_total 158000` | **PASS** |
| **14** | **Grafana Dashboard** | Truy cập `http://localhost:3001` (admin/admin) | Tự động nạp Datasource Prometheus/Loki; Dashboard hiển thị biểu đồ RPS, Doanh thu, Bàn | **PASS** |
| **15** | **Loki & Promtail LogQL** | Truy vấn API `http://localhost:3100/loki/api/v1/query_range` | Thực thi thành công 3 truy vấn: `{job="restaurant-app"}`, filter `ORDER`, filter `INFO` | **PASS** |

---

## 3. CÁC ĐIỂM CẦN LƯU Ý VÀ GIẢI TRÌNH KHI BẢO VỆ

1. **Về cổng HTTP Nginx (8080 thay vì 80):**
   - Trên môi trường Windows 10/11, tiến trình hệ thống `PID 4 (System / HTTP.sys / IIS)` mặc định chiếm giữ cổng `0.0.0.0:80`.
   - Để tránh xung đột quyền truy cập socket (`bind: An attempt was made to access a socket in a way forbidden by its access permissions`), cổng Nginx ngoài host được điều chỉnh linh hoạt qua biến môi trường thành `NGINX_HTTP_PORT=8080`.
   - Cổng bảo mật **HTTPS 443** vẫn chạy đúng cổng chuẩn quốc tế mà không bị xung đột.

2. **Về cảnh báo SSL khi truy cập `https://localhost`:**
   - Chứng chỉ SSL được sinh tự động bằng thuật toán RSA 2048-bit ngay khi build container Nginx (`Self-Signed Certificate`).
   - Do không được cấp bởi một CA công cộng (như Let's Encrypt hay DigiCert), trình duyệt sẽ hiện cảnh báo bảo mật ban đầu. Đây là hiện tượng bình thường đối với các đồ án lab/nội bộ. Chỉ cần bấm *"Advanced"* (Nâng cao) ➔ *"Proceed to localhost (unsafe)"* là kết nối được mã hóa TLS bình thường.

3. **Về tài khoản pgAdmin:**
   - Bộ xác thực email của pgAdmin 4 không cho phép domain đuôi `.local` (như `admin@nhahang.local`).
   - Đã chuẩn hóa thành `admin@nhahang.com` để đảm bảo dịch vụ khởi động ổn định.
