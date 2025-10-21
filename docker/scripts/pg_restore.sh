#! /bin/bash

source ../.env
dumps=(../${PG_BACKUPS_PATH}/*)

if [ "$EUID" -ne 0 ]; then
  echo "Please run the script as root..."
  exit 1
fi

if [ ${#dumps[@]} -eq 0 ]; then
  echo "No backups found ..."
  exit 1
fi

echo "Voulez-vous restaurer dans la base de données existante ou créer une nouvelle base de données ?"
select choice in "Restaurer dans la base de données existante" "Créer une nouvelle base de données"; do
  case $choice in
    "Restaurer dans la base de données existante")
      echo "Quel fichier souhaitez-vous restaurer ?"
      select dump in "${dumps[@]}"; do
        if [ "$dump" ]; then
          echo "Lancement de la restauration de la base de données depuis le fichier $dump ..."
          echo "Veuillez entrer le mot de passe de la base pro :"
          docker exec -i uso.pg_backup pg_restore -h postgres -U pro -d pro -Fc "$dump" --clean
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
      select dump in "${dumps[@]}"; do
        if [ "$dump" ]; then
          echo "Création de la base $newdb ..."
          docker exec -i uso.pg_backup createdb -h postgres -U pro "$newdb"
          echo "Restauration du fichier $dump dans la base $newdb ..."
          docker exec -i uso.pg_backup pg_restore -h postgres -U pro -d "$newdb" -Fc "$dump"
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
