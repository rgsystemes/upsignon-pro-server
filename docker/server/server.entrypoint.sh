#! /bin/sh

if [ $HTTP_PROXY ]; then
    npm config set proxy $HTTP_PROXY
    yarn config set proxy $HTTP_PROXY
fi

envsubst < /app/templates/env.pro.server.j2 > /app/upsignon-pro-server/.env

cd /app/upsignon-pro-server && yarn && yarn build

node ./compiled/server.js
