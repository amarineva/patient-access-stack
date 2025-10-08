FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENV MCP_HTTP=1
ENV MCP_PORT=8080
CMD ["node", "index.js"]



