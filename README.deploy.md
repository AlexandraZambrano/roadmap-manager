Docker and local MongoDB

This project can run with Docker using a local MongoDB container so you don't need the cloud DB.

1) Start containers

   docker-compose up -d --build

2) Export data from remote DB (optional)

   ./scripts/export_mongo_dump.sh "<REMOTE_MONGO_URI>" ./dump

3) Import data into local Mongo (optional)

   ./scripts/import_mongo_dump.sh "mongodb://localhost:27017/bootcamp-manager" ./dump/dump.archive

Notes:
- The app service uses environment variable MONGO_URI=mongodb://mongo:27017/bootcamp-manager inside the compose network.
- If your external auth server runs on host, set EXTERNAL_AUTH_URL_DEV to http://host.docker.internal:8000 so the container can reach your machine's host services.
