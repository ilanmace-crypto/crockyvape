FROM node:20-alpine

WORKDIR /app

# Copy server files
COPY server/package*.json ./server/

# Install dependencies
RUN cd server && npm install

# Copy all source files including database
COPY server/ ./server/
COPY database ./server/database

# Initialize database
RUN cd server && npm run init-db

# Expose port
EXPOSE 10000

# Start server
WORKDIR /app/server
CMD ["npm", "start"]
