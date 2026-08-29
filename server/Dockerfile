FROM node:22

WORKDIR /app
COPY . .
RUN npm install

WORKDIR /app/server
EXPOSE 4100

CMD ["npx", "tsx", "src/index.ts"]
