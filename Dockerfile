# ============================================================
# Stage 1: Build assets (webpack)
# ============================================================
FROM node:20-alpine AS assets

ENV CYPRESS_INSTALL_BINARY=0
ENV NODE_OPTIONS=--openssl-legacy-provider
ENV YARN_CACHE_FOLDER=/tmp/.yarn-cache

RUN apk add --no-cache g++ make cmake python3
RUN corepack enable && corepack prepare yarn@1.22.22 --activate

WORKDIR /wiki

COPY package.json ./
COPY yarn.lock ./
COPY .babelrc ./
COPY .eslintignore ./
COPY .eslintrc.yml ./
COPY patches ./patches

RUN yarn cache clean && \
    yarn --non-interactive --link-duplicates --ignore-optional && \
    yarn cache clean

COPY client ./client
COPY dev ./dev

RUN node ./node_modules/.bin/cross-env NODE_OPTIONS=--openssl-legacy-provider \
    node ./node_modules/.bin/webpack --profile --config dev/webpack/webpack.prod.js

# Keep a single dependency install to avoid ENOSPC on constrained builders.
# Prune dev dependencies after assets build so final image is lighter.
RUN npm prune --omit=dev && \
    yarn cache clean && \
    rm -rf /tmp/.yarn-cache

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

COPY --from=assets /wiki/assets ./assets
COPY --from=assets /wiki/node_modules ./node_modules
COPY server ./server
COPY --from=assets /wiki/server/views/master.pug ./server/views/master.pug
COPY --from=assets /wiki/server/views/setup.pug ./server/views/setup.pug
COPY --from=assets /wiki/server/views/legacy/master.pug ./server/views/legacy/master.pug
# We will inject the configuration dynamically using a Node script at start
COPY generate-config.js ./
USER node

EXPOSE 3000

CMD ["sh", "-c", "node generate-config.js && node server"]
