#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
RUNTIME_DIR="${RUNTIME_DIR:-${REPO_ROOT}/runtime}"
DATABASE_FILE="${DATABASE_FILE:-${RUNTIME_DIR}/backend-data/studentcarr.db}"
UPLOADS_DIR="${UPLOADS_DIR:-${RUNTIME_DIR}/uploads}"
BACKUP_BUCKET="${BACKUP_BUCKET:-studentcarr-demo-backup}"
AWS_REGION="${AWS_REGION:-ap-southeast-2}"

command -v aws >/dev/null 2>&1 || {
  echo "aws CLI is required" >&2
  exit 1
}
command -v python3 >/dev/null 2>&1 || {
  echo "python3 is required" >&2
  exit 1
}
command -v tar >/dev/null 2>&1 || {
  echo "tar is required" >&2
  exit 1
}

if [[ ! -f "$DATABASE_FILE" ]]; then
  echo "Database not found: $DATABASE_FILE" >&2
  exit 1
fi

timestamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
backup_prefix="backups/${timestamp}"
work_dir="$(mktemp -d)"
trap 'rm -rf -- "$work_dir"' EXIT

database_backup="${work_dir}/studentcarr-${timestamp}.db"
uploads_backup="${work_dir}/uploads-${timestamp}.tar.gz"

# Python's SQLite backup API produces a transactionally consistent snapshot,
# including when the live database is using WAL mode.
python3 - "$DATABASE_FILE" "$database_backup" <<'PY'
import sqlite3
import sys

source_path, destination_path = sys.argv[1:]
source = sqlite3.connect(f"file:{source_path}?mode=ro", uri=True)
destination = sqlite3.connect(destination_path)
try:
    source.backup(destination)
finally:
    destination.close()
    source.close()
PY

if [[ -d "$UPLOADS_DIR" ]]; then
  tar -C "$UPLOADS_DIR" -czf "$uploads_backup" .
else
  echo "Uploads directory does not exist; storing an empty archive: $UPLOADS_DIR"
  mkdir -p "${work_dir}/empty-uploads"
  tar -C "${work_dir}/empty-uploads" -czf "$uploads_backup" .
fi

aws s3 cp "$database_backup" "s3://${BACKUP_BUCKET}/${backup_prefix}/studentcarr.db" --region "$AWS_REGION" --only-show-errors
aws s3 cp "$uploads_backup" "s3://${BACKUP_BUCKET}/${backup_prefix}/uploads.tar.gz" --region "$AWS_REGION" --only-show-errors

echo "Backup uploaded to s3://${BACKUP_BUCKET}/${backup_prefix}/"
