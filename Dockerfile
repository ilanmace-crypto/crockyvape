FROM node:20-alpine

WORKDIR /app

# Copy server files
COPY server/package*.json ./server/
COPY database ./database

# Install dependencies
RUN cd server && npm install && npm run init-db

# Copy server source
COPY server/ ./server/

# Expose port
EXPOSE 10000

# Start server
WORKDIR /app/server
CMD ["npm", "start"]
