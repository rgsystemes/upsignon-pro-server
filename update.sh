#!/bin/bash
git remote set-url origin git@github.com:rgsystemes/upsignon-pro-server.git
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
