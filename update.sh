#!/bin/bash
if [ "$(id -u)" -eq 0 ]; then
  echo "This script must not be run as root."
  exit 1
fi

git remote set-url origin https://github.com/rgsystemes/upsignon-pro-server
git fetch origin production
git reset --hard origin/production
git clean -df

# Use a separate script so the update immediatly benefits from the new update script
if [ $? -eq 0 ];
then
  ./post-update.sh
else
  echo "The update failed."
fi
