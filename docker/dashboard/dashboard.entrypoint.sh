#! /bin/sh

if [ $HTTP_PROXY ]; then
    npm config set proxy $HTTP_PROXY
    yarn config set proxy $HTTP_PROXY
fi

envsubst < /app/templates/env.pro.dashboard.front.j2 > /app/upsignon-pro-dashboard/front/.env
envsubst < /app/templates/env.pro.dashboard.back.j2 > /app/upsignon-pro-dashboard/back/.env

cd /app/upsignon-pro-dashboard/front && yarn && npx react-scripts build
cd /app/upsignon-pro-dashboard/back && yarn && yarn build-server

node ./compiledServer/server.js
