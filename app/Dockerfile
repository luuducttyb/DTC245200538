# Base image nhẹ và bảo mật trên Alpine Linux
FROM node:20-alpine

# Thiết lập thư mục làm việc
WORKDIR /app

# Cài đặt dependencies trước để tối ưu Docker layer caching
COPY package.json ./
RUN npm install --omit=dev

# Sao chép toàn bộ mã nguồn ứng dụng
COPY . .

# Hardening: Tạo thư mục log và phân quyền cho người dùng non-root (node)
RUN mkdir -p /var/log/app && \
    chown -R node:node /app /var/log/app

# Chuyển sang người dùng không có quyền root để đảm bảo an toàn
USER node

# Khai báo cổng nội bộ
EXPOSE 3000

# Lệnh khởi chạy ứng dụng
CMD ["npm", "start"]
