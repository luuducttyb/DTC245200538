# ĐỀ 12: HỆ THỐNG QUẢN LÝ NHÀ HÀNG & ORDER (RESTAURANT MANAGEMENT SYSTEM)

Dự án hoàn chỉnh triển khai trên môi trường Docker Compose cho sinh viên/học viên, tích hợp đầy đủ ứng dụng Web, Cơ sở dữ liệu PostgreSQL, Nginx Reverse Proxy, hệ thống giám sát Metrics (Prometheus + Grafana), và thu thập Log tập trung (Loki + Promtail) theo chuẩn bảo mật và vận hành hiện đại.

---

> 📖 **Tài liệu tham khảo chuyên sâu:**
> - [Bảng Kết Quả Kiểm Thử Thực Tế (docs/TEST_RESULTS.md)](docs/TEST_RESULTS.md) - Ghi rõ 15 tiêu chí PASS/FAIL/BLOCKED thực tế.
> - [Đề Cương Báo Cáo & Danh Sách Ảnh Minh Chứng (docs/REPORT_OUTLINE.md)](docs/REPORT_OUTLINE.md) - Cấu trúc 5 chương và 13 ảnh cần chụp.

---

## 1. TỔNG QUAN KIẾN TRÚC & CÁC DỊCH VỤ

Hệ thống bao gồm **8 container dịch vụ** chạy trên 3 mạng nội bộ được phân tách:

```
                  [ Người dùng / Trình duyệt ]
                               │
            ┌──────────────────┴──────────────────┐
            │                                     │
      HTTP Port 8080                        HTTPS Port 443
            │                                     │
            └──────────────────┬──────────────────┘
                               ▼
               [ de12-nginx (Reverse Proxy + SSL) ]
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
 [ de12-app (Node.js) ]  [ de12-grafana ]     [ de12-pgadmin ]
   (Cổng nội bộ 3000)      (Port 3001)           (Port 5050)
        │                      │                      │
        ├───────────────┐      │                      │
        ▼               ▼      ▼                      ▼
[ de12-postgres ]   [ de12-prometheus ] ◄────── [ Metrics ]
  (Không public)        (Port 9090)
        │
   [ File Log ]
        │
        ▼
 [ de12-promtail ] ──► [ de12-loki (Port 3100) ]
```

### Danh sách 8 dịch vụ trong Docker Compose:

| STT | Tên Container | Dịch vụ | Cổng Host | Cổng Container | Ghi chú & Bảo mật |
|:---:|:---|:---|:---:|:---:|:---|
| 1 | `de12-nginx` | Nginx Proxy + SSL | **8080**, **443** | 80, 443 | Reverse proxy, Security Headers, SSL tự ký |
| 2 | `de12-app` | Node.js Express Backend | *Nội bộ* | 3000 | Chạy người dùng **non-root (`node`)**, REST API & Web UI |
| 3 | `de12-postgres` | PostgreSQL 16 Alpine | *Nội bộ* | 5432 | **Hardening: Không mở cổng ra Host**, lưu trữ named volume |
| 4 | `de12-pgadmin` | pgAdmin 4 Web GUI | **5050** | 5050 | Quản trị cơ sở dữ liệu qua giao diện Web |
| 5 | `de12-prometheus` | Prometheus Metrics | **9090** | 9090 | Thu thập số liệu HTTP request, độ trễ, số đơn, doanh thu |
| 6 | `de12-grafana` | Grafana Dashboard | **3001** | 3000 | Tự động nạp sẵn Datasource (Prometheus, Loki) & Dashboard |
| 7 | `de12-loki` | Grafana Loki | **3100** | 3100 | Lưu trữ và lập chỉ mục log có cấu trúc |
| 8 | `de12-promtail` | Promtail Agent | *Nội bộ* | 9080 | Đọc log file ứng dụng đẩy về Loki theo thời gian thực |

---

## 2. BẢNG CÁC ĐƯỜNG DẪN TRUY CẬP & TÀI KHOẢN

| Dịch vụ | Đường dẫn truy cập (URL) | Tài khoản / Mật khẩu | Mục đích sử dụng |
|:---|:---|:---|:---|
| **Website Nhà Hàng (HTTP)** | `http://localhost:8080` | *Không yêu cầu* | Giao diện đặt món, bàn ăn, quản lý đơn hàng |
| **Website Nhà Hàng (HTTPS)** | `https://localhost` | *Không yêu cầu* | Truy cập bảo mật qua SSL (Bỏ qua cảnh báo tự ký) |
| **Grafana Dashboard** | `http://localhost:3001` |  Xem biểu đồ Metrics & Khám phá LogQL |
| **Prometheus Web UI** | `http://localhost:9090` | *Không yêu cầu* | Tra cứu metrics: `targets`, `rules`, truy vấn PromQL |
| **Prometheus Metrics App** | `http://localhost:8080/metrics` | *Không yêu cầu* | Dữ liệu thô Prometheus của Node.js app |
| **pgAdmin 4 (PostgreSQL)** | `http://localhost:5050` |  Quản lý bảng `tables`, `dishes`, `orders`, `order_items` |
| **Grafana Loki API** | `http://localhost:3100` | *Nội bộ/API* | Endpoint nhận và truy vấn LogQL |

---

## 3. HƯỚNG DẪN KHỞI CHẠY TỪNG BƯỚC CHO NGƯỜI MỚI

### Bước 1: Mở Terminal tại thư mục dự án
Mở PowerShell trên Windows và di chuyển vào thư mục:
```powershell
cd D:\DoAn\De12-NhaHang
```

### Bước 2: Kiểm tra cấu hình Docker Compose
```powershell
docker compose config
```
*Lệnh này giúp xác minh cú pháp YAML và toàn bộ biến môi trường `.env` đã hợp lệ.*

### Bước 3: Khởi động toàn bộ hệ thống
```powershell
docker compose up -d --build
```
*Docker sẽ tự động tải các image, build mã nguồn ứng dụng Node.js (non-root), sinh chứng chỉ SSL tự ký cho Nginx, và khởi chạy 8 container.*

### Bước 4: Kiểm tra trạng thái hoạt động của các dịch vụ
```powershell
docker compose ps
```
Tất cả 8 dịch vụ đều phải có trạng thái `Up` (riêng `postgres` có thêm nhãn `healthy`).

### Bước 5: Xem nhật ký hoạt động (Logs) khi cần
- Xem log toàn bộ hệ thống: `docker compose logs -f`
- Xem log ứng dụng chính: `docker compose logs -f app`
- Xem log Nginx: `docker compose logs -f nginx`

### Bước 6: Dừng hệ thống khi không sử dụng
```powershell
docker compose down
```
*(Dữ liệu cơ sở dữ liệu và dashboard vẫn được giữ nguyên an toàn trong các Docker Named Volumes).*

---

## 4. TÍNH NĂNG ỨNG DỤNG QUẢN LÝ NHÀ HÀNG

1. **Quản lý Sơ đồ Bàn ăn (Tables View):**
   - Theo dõi trạng thái trực quan: Bàn trống (Xanh lá) hoặc Bàn đang có khách (Cam).
   - Tự động gắn mã đơn hàng và tổng tiền hiện tại của bàn ăn.
   - Thao tác nhanh: Bấm **➕ Đặt Món** để tạo đơn ngay cho bàn đó.

2. **Thực đơn Món ăn (Dishes View):**
   - Hiển thị danh mục: Món chính, Khai vị, Đồ uống, Tráng miệng.
   - Giá bán niêm yết rõ ràng theo định dạng VNĐ.
   - Nút chuyển trạng thái nhanh giữa **Còn hàng** và **Hết hàng**.
   - Hỗ trợ thêm món mới vào thực đơn qua Modal.

3. **Quản lý Đơn hàng (Orders View):**
   - Tạo đơn hàng mới kèm theo chọn bàn, chọn nhiều món với số lượng tùy ý.
   - **Tính toán tổng tiền trực tiếp thời gian thực** (Live Calculation) trên giao diện trước khi gửi.
   - Backend xác thực giá từ database PostgreSQL và tính tiền tự động trong Transaction an toàn.
   - Tự động chuyển trạng thái bàn ăn sang `CO_KHACH` khi tạo đơn.
   - Quy trình cập nhật trạng thái đơn hàng:
     - `Chờ xử lý` ➔ `Đang chuẩn bị (Bếp)` ➔ `Đã phục vụ (Lên bàn)` ➔ `Đã thanh toán`.
   - Khi chọn **💵 Thanh Toán & Trả Bàn**, hệ thống tự động giải phóng bàn ăn về trạng thái `TRONG` và tích lũy doanh thu vào hệ thống.

---

## 5. HỆ THỐNG GIÁM SÁT & LOGGING (MONITORING & LOGGING)

### A. Prometheus Metrics
Ứng dụng sử dụng thư viện `prom-client` thu thập số liệu thực tế qua endpoint `/metrics`:
- `http_requests_total`: Đếm tổng số lượt request HTTP theo method, route, status code.
- `http_request_duration_seconds`: Histogram đo thời gian xử lý request.
- `restaurant_orders_total`: Số lượng đơn hàng phân loại theo trạng thái (`CHO_XU_LY`, `DA_THANH_TOAN`...).
- `restaurant_revenue_total`: Doanh thu tích lũy từ các đơn đã thanh toán (VNĐ).
- `restaurant_active_tables`: Số bàn hiện đang có khách ngồi.
- Toàn bộ metrics mặc định của Node.js: Heap Memory, Event Loop Lag, CPU usage.

### B. Grafana Dashboard
- Đã được cấu hình tự động nạp sẵn (Auto-Provisioning) không cần thao tác tay.
- Mở `http://localhost:3001` (User: `admin` / Pass: `admin`).
- Vào menu **Dashboards** ➔ Chọn **Hệ Thống Nhà Hàng - Tổng Quan Giám Sát**.
- Dashboard hiển thị đầy đủ các biểu đồ: Request Rate theo mã lỗi, Doanh thu, Bàn có khách, Trạng thái đơn và Mức sử dụng bộ nhớ Heap.

### C. 3 Câu Truy Vấn LogQL Mẫu Chạy Được Trong Loki & Grafana
Truy cập **Grafana** ➔ **Explore** (Icon la bàn) ➔ Chọn Datasource **Loki**:

1. **Truy vấn 1: Xem toàn bộ log của ứng dụng nhà hàng**
   ```logql
   {job="restaurant-app"}
   ```
   *Ý nghĩa: Lọc tất cả các dòng nhật ký được sinh ra từ container ứng dụng Node.js.*

2. **Truy vấn 2: Lọc các sự kiện liên quan đến đơn hàng (Tạo đơn, cập nhật trạng thái, thanh toán)**
   ```logql
   {job="restaurant-app"} |= "ORDER"
   ```
   *Ý nghĩa: Tìm kiếm các log mang nhãn ORDER chứa thông tin mã đơn, bàn ăn và số tiền.*

3. **Truy vấn 3: Lọc nhật ký các request HTTP thành công và độ trễ xử lý**
   ```logql
   {job="restaurant-app"} |= "HTTP" |= "200"
   ```
   *Ý nghĩa: Giám sát toàn bộ các lượt truy vấn API trả về HTTP 200 kèm thời gian phản hồi (ms).*

---

## 6. KIỂM TRA BẢO MẬT & HARDENING ĐÃ TRIỂN KHAI

1. **Phân tách mạng (Network Isolation):**
   - `backend-net`: Mạng nội bộ riêng biệt có cờ `internal: true`. Container `postgres` chỉ giao tiếp trong mạng này, không thể bị truy cập trái phép từ bên ngoài mạng Host.
   - Cổng 5432 của PostgreSQL **hoàn toàn không được publish ra host** (Bảo vệ dữ liệu tuyệt đối).

2. **Non-root Container:**
   - Container ứng dụng `de12-app` chạy dưới tài khoản người dùng `node` (UID: 1000), không chạy quyền `root`, giảm thiểu tối đa nguy cơ chiếm quyền điều khiển container.

3. **Quản lý mật khẩu & Biến môi trường:**
   - Tách biệt file `.env` chứa mật khẩu mạnh.
   - File `.gitignore` ngăn chặn rò rỉ `.env` và `node_modules` lên kho mã nguồn Git.
   - Cung cấp file mẫu `.env.example` chuẩn mực.

4. **Nginx Security Headers & SSL:**
   - `server_tokens off`: Ẩn thông tin phiên bản Nginx để tránh dò quét lỗ hổng.
   - `X-Frame-Options: SAMEORIGIN`: Ngăn chặn tấn công Clickjacking.
   - `X-Content-Type-Options: nosniff`: Ngăn chặn MIME-type sniffing.
   - `X-XSS-Protection: 1; mode=block`: Chặn tấn công Cross-Site Scripting.
   - `Strict-Transport-Security (HSTS)`: Bắt buộc mã hóa bảo mật trên giao thức HTTPS.

---

## 7. CHECKLIST KIỂM THỬ THỰC TẾ (TEST CHECKLIST)

| Hạng mục kiểm tra | Lệnh hoặc Thao tác | Kết quả mong đợi | Trạng thái |
|:---|:---|:---|:---:|
| **1. Cấu hình Compose** | `docker compose config` | Cú pháp hợp lệ, nạp đúng biến môi trường, Exit Code 0 | **PASS** |
| **2. Container Health** | `docker compose ps` | 8/8 containers chạy `Up`, `postgres` đạt trạng thái `healthy` | **PASS** |
| **3. Non-root user** | `docker exec de12-app whoami` | Trả về `node` (không phải root) | **PASS** |
| **4. HTTP Reverse Proxy** | `curl -i http://localhost:8080/health` | HTTP 200 OK, trả về JSON `{status: "UP"}` | **PASS** |
| **5. Security Headers** | Kiểm tra header phản hồi từ Nginx | Có `X-Frame-Options`, `nosniff`, `XSS-Protection` | **PASS** |
| **6. HTTPS Proxy (SSL)** | `curl -k -i https://localhost/health` | HTTPS 200 OK qua cổng 443, có header `Strict-Transport-Security` | **PASS** |
| **7. Cơ sở dữ liệu mẫu** | `curl http://localhost:8080/api/tables` | Trả về danh sách 10 bàn ăn với trạng thái ban đầu | **PASS** |
| **8. Tạo đơn & Tính tiền** | `POST /api/orders` | Tự động tính đúng tổng tiền, tự chuyển bàn sang `CO_KHACH` | **PASS** |
| **9. Cập nhật trạng thái** | `PUT /api/orders/:id/status` | Chuyển trạng thái `DA_THANH_TOAN`, tự trả bàn về `TRONG` | **PASS** |
| **10. Prometheus Scrape** | `http://localhost:9090/api/v1/targets` | Target `restaurant-app` báo `Health: UP` | **PASS** |
| **11. Grafana Datasource** | `http://localhost:3001` | Nạp sẵn Datasource Prometheus và Loki | **PASS** |
| **12. Grafana Dashboard** | Mở Dashboard "Hệ Thống Nhà Hàng" | Hiển thị biểu đồ RPS, Doanh thu, Bàn khách, Heap memory | **PASS** |
| **13. Loki & Promtail Logs** | Chạy LogQL `{job="restaurant-app"}` | Nhận log thời gian thực từ container ứng dụng | **PASS** |
| **14. Cô lập Database** | `netstat -ano \| findstr 5432` | Cổng 5432 không xuất hiện trên Host | **PASS** |

---

## 8. DÀN Ý BÁO CÁO ĐỒ ÁN (OUTLINE BÁO CÁO)

Dành cho sinh viên trình bày trước hội đồng hoặc nộp báo cáo môn học:

### CHƯƠNG 1: GIỚI THIỆU ĐỀ TÀI & BÀI TOÁN THỰC TẾ
- **1.1. Đặt vấn đề:** Nhu cầu tự động hóa quy trình quản lý bàn ăn, đặt món và theo dõi doanh thu trong nhà hàng.
- **1.2. Mục tiêu đề tài:** Xây dựng hệ thống quản lý hoàn chỉnh từ giao diện người dùng, cơ sở dữ liệu đến hạ tầng vận hành container hóa, giám sát và bảo mật.
- **1.3. Phạm vi đề tài:** Đề 12 - Hệ thống Quản lý Nhà hàng / Order.

### CHƯƠNG 2: THIẾT KẾ KIẾN TRÚC & CÔNG NGHỆ ÁP DỤNG
- **2.1. Ngăn xếp công nghệ (Tech Stack):**
  - Backend & Frontend: Node.js, Express, Vanilla HTML5/CSS3/JavaScript.
  - Cơ sở dữ liệu: PostgreSQL 16 Alpine, công cụ quản trị pgAdmin 4.
  - Proxy & Gateway: Nginx Web Server với chứng chỉ HTTPS tự ký.
  - Giám sát & Đo kiểm: Prometheus Server và Grafana Dashboard.
  - Quản lý nhật ký: Grafana Loki và Promtail Agent.
- **2.2. Thiết kế Cơ sở dữ liệu:**
  - Lược đồ cơ sở dữ liệu (ERD): Quan hệ giữa các thực thể `tables`, `dishes`, `orders`, `order_items`.
  - Toàn vẹn dữ liệu và Transaction khi xử lý đơn hàng.
- **2.3. Thiết kế luồng dữ liệu:**
  - Luồng tạo đơn hàng, tính tiền tự động và đồng bộ trạng thái bàn ăn.

### CHƯƠNG 3: TRIỂN KHAI HẠ TẦNG VỚI DOCKER COMPOSE
- **3.1. Đóng gói Container:**
  - Dockerfile tối ưu hóa kích thước và layer caching cho Node.js và Nginx.
  - Áp dụng kỹ thuật non-root user (`node`) nâng cao tính an toàn.
- **3.2. Cấu hình dịch vụ Docker Compose:**
  - Phân chia 3 vùng mạng: `frontend-net`, `backend-net (internal)`, `monitoring-net`.
  - Quản lý dữ liệu bền vững bằng Named Volumes (`pg_data`, `loki_data`, `grafana_data`...).
  - Quản lý cấu hình qua biến môi trường (`.env`).
- **3.3. Cấu hình Nginx Reverse Proxy & SSL:**
  - Cấu hình chuyển hướng và cân bằng tải.
  - Triển khai bộ Security Headers: X-Frame-Options, CSP, HSTS.

### CHƯƠNG 4: HỆ THỐNG GIÁM SÁT & QUẢN LÝ NHẬT KÝ (MONITORING & LOGGING)
- **4.1. Thu thập và trực quan hóa số liệu với Prometheus & Grafana:**
  - Tích hợp `prom-client` thu thập số liệu đặc thù của nghiệp vụ nhà hàng.
  - Thiết kế Dashboard Grafana trực quan.
- **4.2. Quản lý nhật ký tập trung với Loki & Promtail:**
  - Cơ chế thu thập log file không làm gián đoạn hiệu năng ứng dụng.
  - Khai thác nhật ký với ngôn ngữ truy vấn LogQL.

### CHƯƠNG 5: ĐÁNH GIÁ BẢO MẬT & KẾT QUẢ KIỂM THỬ
- **5.1. Đánh giá Hardening:**
  - Kiểm soát cổng truy cập, cô lập cơ sở dữ liệu.
  - Bảo vệ thông tin xác thực, phân quyền container.
- **5.2. Kết quả kiểm thử thực tế:**
  - Bảng tổng hợp kiểm thử 14 tiêu chí chức năng và phi chức năng.
- **5.3. Kết luận và Hướng phát triển:**
  - Đánh giá mức độ hoàn thành so với yêu cầu đề bài.
  - Hướng mở rộng: Thanh toán online, phân quyền vai trò nhân viên (Thu ngân / Bếp / Phục vụ).
