FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Run as non-root unprivileged user for security
USER node

EXPOSE 6000

ENV PORT=6000 \
    NODE_ENV=production

CMD ["node", "runner.js"]
