#! /bin/bash

if [ "$EUID" -ne 0 ]; then
  echo "Please run the script as root..."
  exit 1
fi

if [ ! -d "/var/lib/docker" ]; then
  echo "Docker is not installed. Please install Docker before running this script..."
  exit 1
fi

echo "Start Upsignon..."
SESSION_SECRET=$(openssl rand -hex 30)
sed -i "s/SESSION_SECRET.*/SESSION_SECRET=$SESSION_SECRET/" .env
docker compose up -d

echo "Initializing the application..."
source .env
while ! docker logs uso.dashboard 2>&1 | grep -q "port: $DASHBOARD_PORT"; do
    echo "Waiting for the application to start ..."
    sleep 20
done

# Create the Super Admin
SA_URL=$(docker exec -it uso.dashboard node /app/upsignon-pro-dashboard/back/scripts/addSuperAdmin.js | tail -n 1)
echo "Super Admin has been created successfully. The URL is valid for 5 minutes : $SA_URL"

# Initialize the database
docker exec -it uso.postgres psql -U pro -d pro -c \
  "INSERT INTO settings (key,value) VALUES ('PRO_SERVER_URL_CONFIG', '{\"url\":\"https://$SERVER_DOMAIN\"}');"
docker exec -it uso.postgres psql -U pro -d pro -c \
  "INSERT INTO settings (key,value) VALUES ('EMAIL_CONFIG', '{\"EMAIL_HOST\":\"$SMTP_HOST\",\"EMAIL_PORT\":$SMTP_PORT,\"EMAIL_USER\":\"$SMTP_USER\", \"EMAIL_PASS\":\"$SMTP_PASSWORD\",\"EMAIL_SENDING_ADDRESS\":\"$SMTP_SENDING_USER\", \"EMAIL_ALLOW_INVALID_CERTIFICATE\":$SMTP_ALLOW_INVALID_CRT}');"

