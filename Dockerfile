# Use Oracle Linux for better Oracle client compatibility
FROM node:20-bullseye-slim

WORKDIR /usr/src/app

# Install Oracle Instant Client + Chromium dependencies for puppeteer
RUN apt-get update && apt-get install -y \
    libaio1 \
    wget \
    unzip \
    chromium \
    libglib2.0-0 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Tell puppeteer to use system Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Download and install Oracle Instant Client
RUN wget https://download.oracle.com/otn_software/linux/instantclient/2350000/instantclient-basic-linux.x64-23.5.0.24.07.zip \
    && unzip instantclient-basic-linux.x64-23.5.0.24.07.zip -d /opt/oracle \
    && rm instantclient-basic-linux.x64-23.5.0.24.07.zip

# Set Oracle environment variables
ENV LD_LIBRARY_PATH=/opt/oracle/instantclient_23_5:$LD_LIBRARY_PATH
ENV PATH=/opt/oracle/instantclient_23_5:$PATH

# Copy package files first for better caching
COPY package*.json ./

# Install production dependencies (skip prepare script for husky)
RUN npm pkg delete scripts.prepare && npm ci --omit=dev

# Copy application files
COPY . .

# Expose the port
EXPOSE 3000

# Run in production mode
ENV NODE_ENV=production

CMD ["node", "./bin/www"]
