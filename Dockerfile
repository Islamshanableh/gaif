# Use Oracle Linux for better Oracle client compatibility
FROM node:20-bullseye-slim

WORKDIR /usr/src/app

# Install Oracle Instant Client dependencies
RUN apt-get update && apt-get install -y \
    libaio1 \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Download and install Oracle Instant Client
RUN wget https://download.oracle.com/otn_software/linux/instantclient/2350000/instantclient-basic-linux.x64-23.5.0.24.07.zip \
    && unzip instantclient-basic-linux.x64-23.5.0.24.07.zip -d /opt/oracle \
    && rm instantclient-basic-linux.x64-23.5.0.24.07.zip

# Set Oracle environment variables
ENV LD_LIBRARY_PATH=/opt/oracle/instantclient_23_5:$LD_LIBRARY_PATH
ENV PATH=/opt/oracle/instantclient_23_5:$PATH

# Copy package files first for better caching
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Expose the port
EXPOSE 3000

# Run in production mode
ENV NODE_ENV=production

CMD ["npm", "start"]
