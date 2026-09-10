#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
BACKUP_BUCKET="${BACKUP_BUCKET:-studentcarr-demo-backup}"
AWS_REGION="${AWS_REGION:-ap-southeast-2}"
BASH_PATH="$(command -v bash)"

service_file="$(mktemp)"
timer_file="$(mktemp)"
trap 'rm -f "$service_file" "$timer_file"' EXIT

cat >"$service_file" <<EOF
[Unit]
Description=StudentCarr SQLite and uploads backup to S3
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=${REPO_ROOT}
Environment=AWS_REGION=${AWS_REGION}
Environment=BACKUP_BUCKET=${BACKUP_BUCKET}
ExecStart=${BASH_PATH} ${REPO_ROOT}/deploy/backup.sh
EOF

cat >"$timer_file" <<'EOF'
[Unit]
Description=Run the StudentCarr backup every two days

[Timer]
OnStartupSec=15min
OnUnitActiveSec=2d
AccuracySec=5min
RandomizedDelaySec=15min
Unit=studentcarr-backup.service

[Install]
WantedBy=timers.target
EOF

sudo install -m 644 "$service_file" /etc/systemd/system/studentcarr-backup.service
sudo install -m 644 "$timer_file" /etc/systemd/system/studentcarr-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now studentcarr-backup.timer

echo "Installed two-day backup timer. Next run:"
systemctl list-timers studentcarr-backup.timer --no-pager
