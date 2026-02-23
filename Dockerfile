# ============================================================
# Stage 1: Build assets (webpack)
# ============================================================
FROM node:20-alpine AS assets

ENV CYPRESS_INSTALL_BINARY=0
ENV NODE_OPTIONS=--openssl-legacy-provider

RUN apk add --no-cache yarn g++ make cmake python3

WORKDIR /wiki

COPY package.json ./
COPY .babelrc ./
COPY .eslintignore ./
COPY .eslintrc.yml ./
COPY patches ./patches

RUN yarn cache clean && \
    yarn --frozen-lockfile --non-interactive && \
    yarn cache clean

COPY client ./client
COPY dev ./dev

RUN node ./node_modules/.bin/cross-env NODE_OPTIONS=--openssl-legacy-provider \
    node ./node_modules/.bin/webpack --profile --config dev/webpack/webpack.prod.js

# ============================================================
# Stage 2: Production image
# ============================================================
FROM node:20-alpine

ENV CYPRESS_INSTALL_BINARY=0
ENV NODE_ENV=production

RUN apk add --no-cache bash curl git openssh gnupg sqlite && \
    mkdir -p /wiki /logs /wiki/data/content && \
    chown -R node:node /wiki /logs

WORKDIR /wiki

COPY package.json ./
COPY .npmrc ./

RUN yarn --production --frozen-lockfile --non-interactive && \
    yarn cache clean

COPY --from=assets /wiki/assets ./assets
COPY server ./server
# We will inject the configuration dynamically using a Node script at start
USER node

EXPOSE 3000

CMD node -e "\
const fs = require('fs');\n\
const config = \`port: 3000\n\
bindIP: 0.0.0.0\n\
db:\n\
  type: \${process.env.DB_TYPE || 'postgres'}\n\
  host: \${process.env.DB_HOST || 'db'}\n\
  port: \${process.env.DB_PORT || 5432}\n\
  user: '\${process.env.DB_USER}'\n\
  pass: '\${process.env.DB_PASS}'\n\
  db: \${process.env.DB_NAME}\n\
  ssl: \${process.env.DB_SSL === 'true'}\n\
\`;\n\
fs.writeFileSync('config.yml', config);\n\
console.log('--- EasyPanel config.yml created ---');\n\
" && node server
