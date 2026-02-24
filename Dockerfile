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

COPY patches ./patches
COPY package.json ./
COPY .npmrc ./

RUN yarn --production --frozen-lockfile --non-interactive && \
    npx patch-package && \
    yarn cache clean

COPY --from=assets /wiki/assets ./assets
COPY server ./server
COPY --from=assets /wiki/server/views/master.pug ./server/views/master.pug
COPY --from=assets /wiki/server/views/setup.pug ./server/views/setup.pug
COPY --from=assets /wiki/server/views/legacy/master.pug ./server/views/legacy/master.pug
# We will inject the configuration dynamically using a Node script at start
COPY generate-config.js ./
USER node

EXPOSE 3000

CMD ["sh", "-c", "node generate-config.js && node server"]
