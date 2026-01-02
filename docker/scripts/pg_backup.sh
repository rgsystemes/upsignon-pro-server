#! /bin/bash

# Requirements
DB_BACKUPS_CONTAINER="uso.pg_backup"
if [ $EUID -ne 0 ]; then
  echo "⚠️  Please run the script as root..."
  exit 1
elif [ ! -d "/var/lib/docker" ]; then
  echo "⚠️  Docker is not installed. Please install Docker before running this script..."
  exit 1
elif [ ! "$(docker ps -a --filter "name=$DB_BACKUPS_CONTAINER" --format "{{.Names}}")" ]; then
  echo "⚠️  The '$DB_BACKUPS_CONTAINER' container is not running. Please start the script init.sh before running this script..."
  exit 1
fi

# Absolute path of this script's directory
SCRIPT_DIR="$(dirname "$(realpath ${BASH_SOURCE[0]})" | sed 's|\(/docker\).*|\1|')" && cd $SCRIPT_DIR

# Load environment variables
source $SCRIPT_DIR/.env
DB_BACKUPS_PATH="${DB_BACKUPS_PATH#./}" && FULL_DB_BACKUPS_PATH="$SCRIPT_DIR/$DB_BACKUPS_PATH"

# Perform DB backup
DUMP_FILE="$(date +%Y-%m-%d-%H-%M-%S).dump"
docker exec -i $DB_BACKUPS_CONTAINER sh -c "pg_dump -h postgres -U $DB_USER -Fc pro > /backup/$DUMP_FILE"

# Check if the backup was successful
if [ -s "$FULL_DB_BACKUPS_PATH/$DUMP_FILE" ]; then
  echo "✅ Backup done at $(date +%Y-%m-%d_%H:%M:%S) in $FULL_DB_BACKUPS_PATH/$DUMP_FILE"
else
  echo "❌ Backup failed"
fi
