#!/bin/bash

# SSL initialization script for aqabaconf.com
# Run this script once on the server to obtain the SSL certificate

EMAIL="islam.alshanableh@gmail.com"

echo "=== Creating required directories ==="
mkdir -p ./nginx/ssl
mkdir -p ./certbot/www

echo "=== Creating temporary nginx config for certificate generation ==="
cat > ./nginx/nginx-temp-aqaba.conf << 'TEMPCONF'
events {
    worker_connections 1024;
}

http {
    server {
        listen 80;
        server_name aqabaconf.com www.aqabaconf.com;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 200 'OK';
            add_header Content-Type text/plain;
        }
    }
}
TEMPCONF

echo "=== Stopping main nginx (if running) to free port 80 ==="
docker stop gaif-nginx 2>/dev/null || true

echo "=== Starting temporary nginx on port 80 ==="
docker run -d --name temp-nginx-aqaba \
    -p 80:80 \
    -v $(pwd)/nginx/nginx-temp-aqaba.conf:/etc/nginx/nginx.conf:ro \
    -v $(pwd)/certbot/www:/var/www/certbot \
    nginx:alpine

echo "=== Waiting for nginx to start ==="
sleep 5

echo "=== Requesting SSL certificate for aqabaconf.com ==="
docker run --rm \
    -v $(pwd)/nginx/ssl:/etc/letsencrypt \
    -v $(pwd)/certbot/www:/var/www/certbot \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d aqabaconf.com \
    -d www.aqabaconf.com

echo "=== Stopping temporary nginx ==="
docker stop temp-nginx-aqaba
docker rm temp-nginx-aqaba

echo "=== Cleaning up ==="
rm ./nginx/nginx-temp-aqaba.conf

echo "=== Restarting main nginx ==="
docker start gaif-nginx 2>/dev/null || true

echo ""
echo "=== SSL Setup Complete for aqabaconf.com ==="
echo "Certificate stored at: ./nginx/ssl/live/aqabaconf.com/"
echo ""
echo "Now redeploy with:"
echo "  docker compose -f docker-compose.prod.yaml up -d --build"
echo ""
