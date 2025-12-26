#! /bin/bash

SA_URL=$(docker exec -it uso.dashboard node /app/upsignon-pro-dashboard/back/scripts/addSuperAdmin.js | tail -n 1)
echo "Super Admin created successfully. URL valid for 5 min: $SA_URL"
