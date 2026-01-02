#! /bin/bash

# Requirements
DASHBOARD_CONTAINER="uso.dashboard"
if [ $EUID -ne 0 ]; then
  echo "⚠️  Please run the script as root..."
  exit 1
elif [ ! -d "/var/lib/docker" ]; then
  echo "⚠️  Docker is not installed. Please install Docker before running this script..."
  exit 1
elif [ ! "$(docker ps -a --filter "name=$DASHBOARD_CONTAINER" --format "{{.Names}}")" ]; then
  echo "⚠️  The '$DASHBOARD_CONTAINER' container is not running. Please start the script init.sh before running this script..."
  exit 1
fi

# Generate Super Admin URL
SA_URL=$(docker exec -it $DASHBOARD_CONTAINER node /app/upsignon-pro-dashboard/back/scripts/addSuperAdmin.js | tail -n 1)
echo "Super Admin URL has been successfully created. It will remain valid for 5 minutes : $SA_URL"
