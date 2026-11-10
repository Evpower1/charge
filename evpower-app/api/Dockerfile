# Build context is evpower-app/, not api/.
FROM node:24-bookworm-slim
WORKDIR /opt/evpower/api
COPY --chown=node:node api/package.json api/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node api/src ./src
COPY --chown=node:node operator ../operator
COPY --chown=node:node docs/public ../docs/public
# The optional browser preview may be served separately; native apps use /v1.
RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4100 DATABASE_PATH=/data/mobile.sqlite
USER node
EXPOSE 4100
VOLUME ["/data"]
CMD ["node", "src/server.mjs"]
