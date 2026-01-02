#! /bin/bash

# Requirements
DB_BACKUPS_CONTAINER="uso.postgres"
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

# List available backups
shopt -s nullglob && DUMPS=($DB_BACKUPS_PATH/*)
if [[ $DUMPS ]]; then
  echo "Voulez-vous restaurer dans la base de données existante ou créer une nouvelle base de données ?"
  select CHOICE in "Restaurer dans la base de données existante" "Créer une nouvelle base de données"; do
    case $CHOICE in
      "Restaurer dans la base de données existante")
        echo "Quel fichier souhaitez-vous restaurer ?"
        select dump in "${DUMPS[@]}"; do
          if [ $dump ]; then
            echo "Lancement de la restauration de la base de données depuis le fichier $dump ..."
            echo "Veuillez entrer le mot de passe de la base pro :"
            docker exec -i $DB_BACKUPS_CONTAINER pg_restore -h postgres -U pro -d pro -Fc $dump --clean
            break
          else
            echo "Choix invalide ..."
          fi
        done
        break
        ;;
      "Créer une nouvelle base de données")
        echo "Nom de la nouvelle base de données :"
        read newdb
        echo "Quel fichier souhaitez-vous restaurer ?"
        select dump in "${DUMPS[@]}"; do
          if [ $dump ]; then
            echo "Création de la base $newdb ..."
            docker exec -i $DB_BACKUPS_CONTAINER createdb -h postgres -U pro "$newdb"
            echo "Restauration du fichier $dump dans la base $newdb ..."
            docker exec -i $DB_BACKUPS_CONTAINER pg_restore -h postgres -U pro -d "$newdb" -Fc $dump
            break
          else
            echo "Choix invalide ..."
          fi
        done
        break
        ;;
      *)
        echo "Choix invalide ..."
        ;;
    esac
  done
else
  echo "⚠️  No backup files found in the $DB_BACKUPS_PATH directory. Please create a backup before proceeding. Script stopped."
  exit 1
fi
