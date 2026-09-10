#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_FILE="${OUTPUT_FILE:-${SCRIPT_DIR}/.env.production}"
SSM_PATH="${SSM_PATH:-/studentcarr/production/}"
AWS_REGION="${AWS_REGION:-ap-southeast-2}"

command -v aws >/dev/null 2>&1 || {
  echo "aws CLI is required" >&2
  exit 1
}
command -v python3 >/dev/null 2>&1 || {
  echo "python3 is required" >&2
  exit 1
}

umask 077
json_file="$(mktemp)"
env_file="$(mktemp)"
trap 'rm -f "$json_file" "$env_file"' EXIT

aws ssm get-parameters-by-path \
  --region "$AWS_REGION" \
  --path "$SSM_PATH" \
  --recursive \
  --with-decryption \
  --output json >"$json_file"

python3 - "$json_file" "$env_file" "$SSM_PATH" <<'PY'
import json
import re
import sys

source_path, output_path, prefix = sys.argv[1:]
with open(source_path, encoding="utf-8") as source:
    parameters = json.load(source).get("Parameters", [])

values = {}
for parameter in parameters:
    name = parameter["Name"]
    if not name.startswith(prefix):
        continue
    key = name.rsplit("/", 1)[-1]
    if not re.fullmatch(r"[A-Z][A-Z0-9_]*", key):
        raise SystemExit(f"Unsafe environment variable name derived from {name!r}")
    value = str(parameter.get("Value", ""))
    if "\n" in value or "\r" in value:
        raise SystemExit(f"Multiline values are not supported: {name}")
    values[key] = value

required = {
    "NODE_ENV",
    "DATABASE_URL",
    "CORS_ORIGIN",
    "APP_BASE_URL",
    "APP_DOMAIN",
    "API_DOMAIN",
    "CADDY_EMAIL",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "FIELD_ENCRYPTION_KEY",
    "MCP_TOKEN_SECRET",
}
missing = sorted(required - values.keys())
if missing:
    raise SystemExit("Missing required SSM parameters: " + ", ".join(missing))

field_key = values["FIELD_ENCRYPTION_KEY"]
if not re.fullmatch(r"[0-9a-fA-F]{64}", field_key):
    raise SystemExit("FIELD_ENCRYPTION_KEY must contain exactly 64 hexadecimal characters")

with open(output_path, "w", encoding="utf-8", newline="\n") as output:
    output.write("# Generated from AWS Systems Manager Parameter Store. Do not edit or commit.\n")
    for key in sorted(values):
        # Compose treats single-quoted dotenv values literally. Escape the two
        # characters that have meaning inside a single-quoted dotenv value.
        escaped = values[key].replace("\\", "\\\\").replace("'", "\\'")
        output.write(f"{key}='{escaped}'\n")
PY

install -m 600 "$env_file" "$OUTPUT_FILE"
echo "Wrote $(grep -c '^[A-Z]' "$OUTPUT_FILE") parameters to $OUTPUT_FILE"
