# ĐỀ CƯƠNG BÁO CÁO ĐỒ ÁN (REPORT OUTLINE)
**Đề tài:** Đề 12 - Hệ Thống Quản Lý Nhà Hàng / Order  
**Học phần:** Chuyên đề / Đồ án Hệ thống & Triển khai Container  

---

## I. CẤU TRÚC CHI TIẾT BÁO CÁO ĐỒ ÁN

### CHƯƠNG 1: TỔNG QUAN VỀ BÀI TOÁN & YÊU CẦU ĐỀ TÀI
- **1.1. Bối cảnh & Tính cấp thiết:**
  - Nhu cầu tin học hóa quy trình vận hành nhà hàng: từ khâu tiếp nhận khách, chọn bàn, gọi món, báo bếp, đến xuất hóa đơn và thanh toán.
  - Thách thức về tính sẵn sàng, khả năng mở rộng, giám sát hiệu năng và an toàn dữ liệu trong các hệ thống dịch vụ ăn uống.
- **1.2. Mục tiêu đề tài:**
  - Xây dựng ứng dụng web quản lý thực đơn, bàn ăn và đơn hàng với khả năng tính tiền tự động.
  - Đóng gói toàn bộ hệ thống bằng Docker Compose với các tiêu chuẩn phân tách mạng và bảo mật hiện đại.
  - Triển khai cổng Gateway Nginx hỗ trợ HTTPS và Security Headers.
  - Xây dựng hệ thống giám sát Metrics (Prometheus + Grafana) và quản lý nhật ký tập trung (Loki + Promtail).
- **1.3. Yêu cầu chức năng và phi chức năng:**
  - Chức năng: Quản lý bàn ăn, thực đơn món, tạo đơn hàng tính tiền tự động, cập nhật trạng thái đơn và đồng bộ bàn.
  - Phi chức năng: Bảo mật cơ sở dữ liệu (không lộ cổng), chạy container non-root, có HTTPS, theo dõi tải CPU/RAM/RPS.

---

### CHƯƠNG 2: THIẾT KẾ HỆ THỐNG & CƠ SỞ DỮ LIỆU
- **2.1. Kiến trúc hệ sinh thái dịch vụ (Micro-services / Multi-container):**
  - Sơ đồ tương tác giữa 8 dịch vụ: `Nginx` ➔ `App (Node.js)` ➔ `PostgreSQL`, cùng các thành phần phụ trợ `pgAdmin`, `Prometheus`, `Grafana`, `Loki`, `Promtail`.
- **2.2. Thiết kế Cơ sở dữ liệu quan hệ (PostgreSQL):**
  - Thực thể `tables`: Lưu mã bàn, tên, sức chứa, trạng thái (`TRONG`, `CO_KHACH`).
  - Thực thể `dishes`: Lưu tên món, danh mục, giá tiền, tình trạng (`CON_HANG`, `HET_HANG`).
  - Thực thể `orders`: Lưu mã đơn duy nhất, liên kết bàn ăn, tổng tiền, trạng thái (`CHO_XU_LY` ➔ `DANG_CHUAN_BI` ➔ `DA_PHUC_VU` ➔ `DA_THANH_TOAN` ➔ `DA_HUY`).
  - Thực thể `order_items`: Lưu chi tiết các món trong đơn, số lượng, đơn giá tại thời điểm đặt, thành tiền từng món.
  - Các ràng buộc khóa ngoại và toàn vẹn dữ liệu: `ON DELETE CASCADE` cho chi tiết đơn, `ON DELETE RESTRICT` để bảo vệ món ăn đã có trong lịch sử đơn hàng.
- **2.3. Thiết kế luồng xử lý nghiệp vụ:**
  - Quy trình Transaction khi tạo đơn: Khóa dữ liệu kiểm tra tính hợp lệ của giá ➔ Ghi nhận đơn ➔ Chuyển bàn sang có khách ➔ Bắn metrics sang Prometheus và ghi log.
  - Quy trình thanh toán: Cập nhật trạng thái ➔ Giải phóng bàn về trống ➔ Tích lũy doanh thu.

---

### CHƯƠNG 3: TRIỂN KHAI VÀ BẢO MẬT HẠ TẦNG VỚI DOCKER COMPOSE
- **3.1. Đóng gói ứng dụng với Dockerfile tối ưu:**
  - Sử dụng base image `node:20-alpine` nhẹ và an toàn.
  - Áp dụng kỹ thuật Docker layer caching (tách `package.json` trước `npm install`).
  - Triển khai **Non-root user (`USER node`)** để phòng chống lỗ hổng container breakout.
- **3.2. Cấu hình Docker Compose:**
  - Quản lý cấu hình tập trung qua file `.env` (không đưa mật khẩu vào Git).
  - Phân tách 3 vùng mạng:
    - `backend-net`: Đặt cờ `internal: true` cô lập PostgreSQL khỏi Internet và mạng Host.
    - `frontend-net`: Kết nối Nginx, App, pgAdmin, Grafana.
    - `monitoring-net`: Kết nối Prometheus, Grafana, Loki, Promtail.
  - Lưu trữ bền vững bằng 6 Named Volumes (`pg_data`, `pgadmin_data`, `app_logs`, `prometheus_data`, `grafana_data`, `loki_data`).
- **3.3. Cấu hình Nginx Reverse Proxy & Security Headers:**
  - Chuyển hướng lưu lượng an toàn về backend nội bộ.
  - Sinh chứng chỉ SSL tự ký tự động khi build image.
  - Bộ tiêu chuẩn bảo mật HTTP Header: `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Strict-Transport-Security`, `server_tokens off`.

---

### CHƯƠNG 4: HỆ THỐNG GIÁM SÁT VÀ QUẢN LÝ NHẬT KÝ (OBSERVABILITY)
- **4.1. Giám sát số liệu thời gian thực (Prometheus):**
  - Tích hợp thư viện `prom-client` tạo custom metrics: `http_requests_total`, `http_request_duration_seconds`, `restaurant_orders_total`, `restaurant_revenue_total`, `restaurant_active_tables`.
  - Cơ chế cào số liệu định kỳ (scrape target) qua cổng nội bộ 3000.
- **4.2. Trực quan hóa số liệu (Grafana Dashboard):**
  - Tự động nạp cấu hình Datasource và Dashboard qua cơ chế Auto-Provisioning.
  - Phân tích các biểu đồ: Lưu lượng request (RPS), Tỉ lệ đơn hàng theo trạng thái, Doanh thu tích lũy, Số bàn đang phục vụ, Bộ nhớ Heap của ứng dụng.
- **4.3. Quản lý nhật ký tập trung (Loki & Promtail):**
  - Promtail thu thập file log `/var/log/app/app.log` đẩy về Loki.
  - Phân tích và tra cứu nhật ký ứng dụng bằng ngôn ngữ truy vấn LogQL:
    - Tìm kiếm toàn bộ log: `{job="restaurant-app"}`
    - Lọc sự kiện nghiệp vụ đơn hàng: `{job="restaurant-app"} |= "ORDER"`
    - Lọc thông tin truy vấn thành công: `{job="restaurant-app"} |= "INFO"`

---

### CHƯƠNG 5: KẾT QUẢ KIỂM THỬ, ĐÁNH GIÁ & KẾT LUẬN
- **5.1. Bảng kết quả kiểm thử thực tế:** Đối chiếu 15 tiêu chí kiểm thử chức năng và phi chức năng.
- **5.2. Đánh giá tính an toàn và mức độ hoàn thiện:**
  - So sánh với các yêu cầu ban đầu của đề bài.
  - Điểm mạnh: Hệ thống tự động hóa hoàn toàn, cấu hình một lệnh (`docker compose up -d`), giao diện trực quan, bảo mật cao.
- **5.3. Hướng phát triển mở rộng:**
  - Tích hợp cổng thanh toán trực tuyến (VNPay / MoMo).
  - Phân quyền tài khoản theo vai trò (Quản lý, Thu ngân, Đầu bếp, Bồi bàn).
  - Hỗ trợ in hóa đơn nhiệt qua giao thức mạng.

---

## II. DANH SÁCH ẢNH MINH CHỨNG CẦN CHỤP KHI BÁO CÁO

> [!IMPORTANT]
> **Hướng dẫn chụp ảnh thực tế:** Hãy mở các đường dẫn URL và cửa sổ dòng lệnh tương ứng trên máy tính của bạn để chụp màn hình chèn vào báo cáo. Tuyệt đối không sử dụng ảnh giả hoặc ảnh minh họa không khớp với dự án.

| STT | Tên ảnh minh chứng | Nơi cần chụp (URL / Cửa sổ) | Nội dung cần làm nổi bật trong ảnh |
|:---:|:---|:---|:---|
| **IMG-01** | **Trạng thái 8 Container chạy ổn định** | Mở PowerShell: `docker compose ps` | Cột `STATUS` đều là `Up`, container `de12-postgres` có nhãn `(healthy)`. |
| **IMG-02** | **Xác nhận Non-root User của App** | Mở PowerShell: `docker exec de12-app whoami` | Đầu ra trả về `node` (chứng minh không chạy quyền root). |
| **IMG-03** | **Cô lập Cổng Database & Mạng nội bộ** | Mở PowerShell: `docker ps` & `docker network inspect de12-nhahang_backend-net` | Cổng 5432 không xuất hiện trên Host; thuộc tính `"Internal": true`. |
| **IMG-04** | **Bảo mật Git không chứa file .env** | Mở PowerShell: `git status --ignored` | File `.env` xuất hiện trong mục `Ignored files`, không nằm trong commit. |
| **IMG-05** | **Giao diện Trang chủ & Sơ đồ Bàn ăn** | Trình duyệt: `http://localhost:8080` (Tab Sơ Đồ Bàn Ăn) | Lưới các bàn ăn (Bàn 01 đến 10), màu xanh (Bàn trống) và màu cam (Bàn có khách). |
| **IMG-06** | **Modal Tạo Đơn Hàng & Tính Tiền Tự Động** | Trình duyệt: `http://localhost:8080` (Bấm Tạo Đơn Hàng) | Danh sách món ăn có nút tăng/giảm số lượng và dòng **Tổng tiền tự nhảy theo thời gian thực**. |
| **IMG-07** | **Giao diện Quản lý Đơn hàng & Đổi trạng thái** | Trình duyệt: `http://localhost:8080` (Tab Quản Lý Đơn Hàng) | Các đơn hàng với mã đơn, chi tiết món và nút chuyển trạng thái ("Chuyển Bếp", "Lên Bàn", "Thanh Toán"). |
| **IMG-08** | **Giao diện Thực đơn Món ăn & Bộ lọc** | Trình duyệt: `http://localhost:8080` (Tab Thực Đơn Món Ăn) | Danh sách 14 món ăn, bộ lọc danh mục (Món chính, Khai vị, Đồ uống...) và nút bật/tắt Còn-Hết hàng. |
| **IMG-09** | **Kết nối HTTPS qua cổng 443 & Security Headers** | Trình duyệt: `https://localhost` & F12 Network Tab | Biểu tượng khóa bảo mật HTTPS và danh sách Security Headers (`X-Frame-Options`, `HSTS`...). |
| **IMG-10** | **Quản trị Cơ sở dữ liệu trên pgAdmin 4** | Trình duyệt: `http://localhost:5050` | Giao diện pgAdmin hiển thị cấu trúc 4 bảng `tables`, `dishes`, `orders`, `order_items`. |
| **IMG-11** | **Mục tiêu cào số liệu Prometheus (Targets)** | Trình duyệt: `http://localhost:9090/targets` | Target `restaurant-app (1/1 up)` với màu xanh lá cây báo trạng thái `UP`. |
| **IMG-12** | **Bảng điều khiển Grafana Dashboard** | Trình duyệt: `http://localhost:3001` (Dashboard Nhà Hàng) | Các biểu đồ: Tổng HTTP Requests, Doanh thu, Bàn khách, Tần suất request và Bộ nhớ Heap. |
| **IMG-13** | **Truy vấn LogQL trong Grafana Explore** | Trình duyệt: `http://localhost:3001/explore` (Chọn Loki) | Kết quả thực thi truy vấn `{job="restaurant-app"} \|= "ORDER"` hiển thị chi tiết các dòng log đơn hàng. |
