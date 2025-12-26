#! /bin/bash

if [ $EUID -ne 0 ]; then
  echo "Please run the script as root..."
  exit 1
elif [ ! -d "/var/lib/docker" ]; then
  echo "Docker is not installed. Please install Docker before running this script..."
  exit 1
fi

if [[ $1 == "--help" ]] || [[ $1 == "-h" ]]; then
  echo "Usage: ./init.sh"
  echo ""
  echo "This script initializes and starts the Upsignon Pro application using Docker."
  echo "Make sure Docker is installed and running before executing this script."
  echo "Options:"
  echo "  -h, --help    Show this help message and exit"
  echo "  -le           [MANDATORY] Specify to use Let's Encrypt for TLS certificates"
  echo "  -certs        [MANDATORY] Specify to use custom TLS certificates"
  exit 0
elif [[ $1 == "-le" ]]; then
  echo "Using Let's Encrypt for TLS certificates..."
  CRT=le
elif [[ $1 == "-certs" ]]; then
  echo "Using custom TLS certificates..."
  CRT=certs
elif [[ $1 != "-le" ]] && [[ $1 != "-certs" ]]; then
  echo "Invalid argument. Use --help or -h for usage information."
  exit 1
fi

echo "Start Upsignon..."
SESSION_SECRET=$(openssl rand -hex 30)
sed -i "s/SESSION_SECRET.*/SESSION_SECRET=$SESSION_SECRET/" .env
docker compose -f docker-compose-$CRT.yml up -d

echo "Initializing the application..."
source .env
while ! docker logs uso.dashboard 2>&1 | grep -q "port: $DASHBOARD_PORT"; do
    echo "Waiting for the application to start ..."
    sleep 20
done

# Create the Super Admin
SA_URL=$(docker exec -it uso.dashboard node /app/upsignon-pro-dashboard/back/scripts/addSuperAdmin.js | tail -n 1)
echo "Super Admin has been created successfully. The URL is valid for 5 minutes : $SA_URL"
