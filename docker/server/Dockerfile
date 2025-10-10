FROM node:alpine

WORKDIR /app

COPY files/env.pro.server.j2 /app/templates/
COPY server.entrypoint.sh /app/entrypoint.sh

RUN apk add --no-cache gettext git postgresql-client && \
    git clone https://github.com/rgsystemes/upsignon-pro-server.git && \
    chown -R node: /app && \
    chmod +x /app/entrypoint.sh

USER node

ENTRYPOINT ["/app/entrypoint.sh"]
