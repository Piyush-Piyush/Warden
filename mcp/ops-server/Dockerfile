FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY shared ./shared
COPY mcp/ops-server ./mcp/ops-server
COPY demo ./demo

RUN npm install --workspaces --include-workspace-root=false

WORKDIR /app/mcp/ops-server

EXPOSE 4000

CMD ["npx", "tsx", "src/index.ts"]
