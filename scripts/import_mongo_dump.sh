#!/bin/bash
# Usage: ./scripts/import_mongo_dump.sh <MONGO_URI> <DUMP_ARCHIVE_PATH>
# Example: ./scripts/import_mongo_dump.sh "mongodb://localhost:27017/bootcamp-manager" ./dump.archive

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 <MONGO_URI> <DUMP_ARCHIVE_PATH>"
  exit 1
fi

MONGO_URI="$1"
DUMP_ARCHIVE="$2"

# Restore using mongorestore
mongorestore --uri="$MONGO_URI" --archive="$DUMP_ARCHIVE" --gzip --drop

echo "Restore completed from $DUMP_ARCHIVE"
