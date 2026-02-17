#!/bin/bash

# SSL initialization script for both domains
# Run this script once on the server to obtain SSL certificates

EMAIL="your-email@example.com"  # Change this to your email

echo "=== Creating directories ==="
mkdir -p ./nginx/ssl
mkdir -p ./certbot/www

echo "=== Creating temporary nginx config for certificate generation ==="
cat > ./nginx/nginx-temp.conf << 'TEMPCONF'
events {
    worker_connections 1024;
}

http {
    server {
        listen 80;
        server_name registration.gaif2026.com gaif2026.com www.gaif2026.com;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 200 'GAIF Server Running';
            add_header Content-Type text/plain;
        }
    }
}
TEMPCONF

echo "=== Starting nginx with temporary config ==="
docker run -d --name temp-nginx \
    -p 80:80 \
    -v $(pwd)/nginx/nginx-temp.conf:/etc/nginx/nginx.conf:ro \
    -v $(pwd)/certbot/www:/var/www/certbot \
    nginx:alpine

echo "=== Waiting for nginx to start ==="
sleep 5

echo "=== Requesting SSL certificate for registration.gaif2026.com ==="
docker run --rm \
    -v $(pwd)/nginx/ssl:/etc/letsencrypt \
    -v $(pwd)/certbot/www:/var/www/certbot \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d registration.gaif2026.com

echo "=== Requesting SSL certificate for gaif2026.com ==="
docker run --rm \
    -v $(pwd)/nginx/ssl:/etc/letsencrypt \
    -v $(pwd)/certbot/www:/var/www/certbot \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d gaif2026.com \
    -d www.gaif2026.com

echo "=== Stopping temporary nginx ==="
docker stop temp-nginx
docker rm temp-nginx

echo "=== Cleaning up ==="
rm ./nginx/nginx-temp.conf

echo ""
echo "=== SSL Setup Complete ==="
echo "Now run: docker-compose -f docker-compose.prod.yaml up -d --build"
echo ""
