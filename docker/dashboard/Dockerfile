FROM node:alpine

WORKDIR /app

COPY files/env.pro.dashboard.back.j2 files/env.pro.dashboard.front.j2 /app/templates/
COPY dashboard.entrypoint.sh /app/entrypoint.sh

RUN apk add --no-cache gettext git && \
    git clone https://github.com/rgsystemes/upsignon-pro-dashboard.git && \
    chown -R node: /app && \
    chmod +x /app/entrypoint.sh

USER node

ENTRYPOINT ["/app/entrypoint.sh"]
