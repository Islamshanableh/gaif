FROM node:18

WORKDIR /usr/src/app

# Copy package.json and package-lock.json first
COPY package*.json ./

# Install dependencies
RUN npm install

# Now copy the rest of the application files
COPY . .

CMD npx prisma generate && npm run dev