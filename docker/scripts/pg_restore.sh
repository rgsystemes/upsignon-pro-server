#! /bin/bash

# Requirements
DB_BACKUPS_CONTAINER="uso.pg_backup" && DB_CONTAINER="uso.postgres"
if [ $EUID -ne 0 ]; then
  echo "⚠️  Please run the script as root..."
  exit 1
elif [ ! -d "/var/lib/docker" ]; then
  echo "⚠️  Docker is not installed. Please install Docker before running this script..."
  exit 1
elif [ ! "$(docker ps -a --filter "name=$DB_BACKUPS_CONTAINER" --format "{{.Names}}")" ] || [ ! "$(docker ps -a --filter "name=$DB_CONTAINER" --format "{{.Names}}")" ]; then
  echo "⚠️  The '$DB_BACKUPS_CONTAINER' container is not running. Please start the script init.sh before running this script..."
  exit 1
fi

# Absolute path of this script's directory
SCRIPT_DIR="$(dirname "$(realpath ${BASH_SOURCE[0]})" | sed 's|\(/docker\).*|\1|')" && cd $SCRIPT_DIR

# Load environment variables
source $SCRIPT_DIR/.env
DB_BACKUPS_PATH="${DB_BACKUPS_PATH#./}" && FULL_DB_BACKUPS_PATH="$SCRIPT_DIR/$DB_BACKUPS_PATH"

# List available backups
shopt -s nullglob && DUMPS=($FULL_DB_BACKUPS_PATH/*)
for dump in "${DUMPS[@]}"; do
  DUMP_NAMES+=("${dump##*/}")
done

# Restore database from selected backup
if [[ $DUMPS ]]; then
  echo "ℹ️ Do you want to restore to the existing database or create a new database ?"
  select CHOICE in "Restore to existing database" "Create a new database"; do
    case $CHOICE in
      "Restore to existing database")
        echo "ℹ️ Which file do you want to restore?"
        select dump in "${DUMP_NAMES[@]}"; do
          if [ $dump ]; then
            echo "Starting database restoration from file $dump ..."
            docker exec -i $DB_BACKUPS_CONTAINER pg_restore -h postgres -U pro -d pro -Fc /backup/$dump --clean
            break
          else
            echo "❌ Invalid choice. Script stopped."
          fi
        done
        break
        ;;
      "Create a new database")
        echo "ℹ️ What name would you like to give the new database ?"
        read newdb
        echo "ℹ️ Which file do you want to restore ?"
        select dump in "${DUMP_NAMES[@]}"; do
          if [ $dump ]; then
            echo "⏳ Creating database $newdb ..."
            docker exec -i $DB_BACKUPS_CONTAINER createdb -h postgres -U pro "$newdb"
            echo "⏳ Restoring file $dump into database $newdb ..."
            docker exec -i $DB_BACKUPS_CONTAINER pg_restore -h postgres -U pro -d "$newdb" -Fc /backup/$dump
            break
          else
            echo "❌ Invalid choice. Script stopped."
          fi
        done
        break
        ;;
      *)
        echo "❌ Invalid choice. Script stopped."
        ;;
    esac
  done
else
  echo "❌ No backup files found in the $DB_BACKUPS_PATH directory. Please create a backup before proceeding. Script stopped."
  exit 1
fi
