#!/bin/bash
# Usage: ./scripts/export_mongo_dump.sh <MONGO_URI> <OUT_DIR>
# Example: ./scripts/export_mongo_dump.sh "mongodb+srv://user:pass@cluster.mongodb.net" ./dump

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 <MONGO_URI> <OUT_DIR>"
  exit 1
fi

MONGO_URI="$1"
OUT_DIR="$2"

mkdir -p "$OUT_DIR"

# Use mongodump to export the database
mongodump --uri="$MONGO_URI" --archive="$OUT_DIR/dump.archive" --gzip

echo "Dump written to $OUT_DIR/dump.archive"
