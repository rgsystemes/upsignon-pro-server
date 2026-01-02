#! /bin/bash

# Requirements
TRAEFIK_CONTAINER="uso.traefik"
if [ $EUID -ne 0 ]; then
  echo "⚠️  Please run the script as root..."
  exit 1
elif [ ! -d "/var/lib/docker" ]; then
  echo "⚠️  Docker is not installed. Please install Docker before running this script..."
  exit 1
elif [ ! "$(docker ps -a --filter "name=$TRAEFIK_CONTAINER" --format "{{.Names}}")" ]; then
  echo "⚠️  The '$TRAEFIK_CONTAINER' container is not running. Please start the script init.sh before running this script..."
  exit 1
fi

# Absolute path of this script's directory
SCRIPT_DIR="$(dirname "$(realpath ${BASH_SOURCE[0]})" | sed 's|\(/docker\).*|\1|')" && cd $SCRIPT_DIR

# Check for .crt files in the certs directory
shopt -s nullglob && SSL=certs && CERTS=($SSL/*.crt)
if [[ $CERTS ]]; then
  CERT_FILE=$SSL/tls.yml
  echo -e "tls:\n  certificates:" > $CERT_FILE

  # Add each certificate and its corresponding key to the TLS configuration
  for cert in ${CERTS[@]}; do
    key="${cert%.crt}.key"; if [[ -f $key ]]; then
      echo "    - certFile: /$cert" >> $CERT_FILE
      echo "      keyFile: /$key" >> $CERT_FILE
    else
      echo "❌ No $key file found in the $SSL directory. Please add your private key before proceeding. Script stopped."
      exit 1
    fi
  done
  echo "✅ Traefik TLS configuration generated at $CERT_FILE"
else
  echo "❌ No .crt files found in the $SSL directory. Please add your TLS certificates before proceeding. Script stopped."
  exit 1
fi

# Apply new Traefik configuration
TRAEFIK_SERVICE="traefik" && TRAEFIK_CONTAINER="uso.$TRAEFIK_SERVICE"
echo "⏳ Restarting Traefik to apply changes..."
START_BEFORE=$(docker inspect -f '{{.State.StartedAt}}' $TRAEFIK_CONTAINER)
docker compose -f docker-compose-certs.yml restart $TRAEFIK_SERVICE

# Verify Traefik restart
START_AFTER=$(docker inspect -f '{{.State.StartedAt}}' $TRAEFIK_CONTAINER)
if [ "$START_BEFORE" != "$START_AFTER" ]; then
  echo "✅ Container $TRAEFIK_CONTAINER successfully restarted"
else
  echo "❌ Container $TRAEFIK_CONTAINER was NOT restarted"
  exit 1
fi
