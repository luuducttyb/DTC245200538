FROM nginx:alpine

# Cài đặt openssl để sinh chứng chỉ SSL tự ký một cách tự động khi build image
RUN apk add --no-cache openssl && \
    mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/server.key \
    -out /etc/nginx/ssl/server.crt \
    -subj "/C=VN/ST=Hanoi/L=Hanoi/O=NhaHang/OU=IT/CN=localhost" && \
    chmod 600 /etc/nginx/ssl/server.key && \
    chmod 644 /etc/nginx/ssl/server.crt

# Sao chép cấu hình Nginx tối ưu
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
