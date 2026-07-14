#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

required=(SUPABASE_PRODUCTION_DB_URL SUPABASE_PRODUCTION_PROJECT_REF BACKUP_AGE_RECIPIENT BACKUP_OUTPUT_DIR)
for name in "${required[@]}"; do
    if [[ -z "${!name:-}" ]]; then
        printf 'Required environment variable %s is not set.\n' "$name" >&2
        exit 2
    fi
done

for command_name in supabase psql jq age sha256sum tar; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
        printf 'Required command %s is unavailable.\n' "$command_name" >&2
        exit 2
    fi
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
started_at="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
backup_id="$(date -u +'%Y%m%dT%H%M%SZ')-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
source_commit="${GITHUB_SHA:-$(git -C "$repo_root" rev-parse HEAD)}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"
work_dir="$(mktemp -d)"
payload_dir="$work_dir/payload"
archive_path="$work_dir/${backup_id}.tar.gz"
encrypted_path="$BACKUP_OUTPUT_DIR/${backup_id}.tar.gz.age"
receipt_path="$BACKUP_OUTPUT_DIR/${backup_id}.receipt.json"

cleanup() {
    rm -rf "$work_dir"
}
trap cleanup EXIT

mkdir -p "$payload_dir" "$BACKUP_OUTPUT_DIR"

printf 'Creating encrypted logical backup %s. Database credentials and dump contents will not be logged.\n' "$backup_id"

supabase db dump \
    --db-url "$SUPABASE_PRODUCTION_DB_URL" \
    --file "$payload_dir/roles.sql" \
    --role-only \
    --log-level error

supabase db dump \
    --db-url "$SUPABASE_PRODUCTION_DB_URL" \
    --file "$payload_dir/schema.sql" \
    --log-level error

supabase db dump \
    --db-url "$SUPABASE_PRODUCTION_DB_URL" \
    --file "$payload_dir/data.sql" \
    --use-copy \
    --data-only \
    --exclude 'storage.buckets_vectors' \
    --exclude 'storage.vector_indexes' \
    --log-level error

# Supabase excludes migration history from the main dump by design. Preserve it
# separately so the restored target can prove the exact deployed migration head.
supabase db dump \
    --db-url "$SUPABASE_PRODUCTION_DB_URL" \
    --file "$payload_dir/history-schema.sql" \
    --schema supabase_migrations \
    --log-level error

supabase db dump \
    --db-url "$SUPABASE_PRODUCTION_DB_URL" \
    --file "$payload_dir/history-data.sql" \
    --schema supabase_migrations \
    --use-copy \
    --data-only \
    --log-level error

SANITIZED_INVENTORY_DB_URL="$SUPABASE_PRODUCTION_DB_URL" \
SANITIZED_INVENTORY_SQL_FILE="$repo_root/scripts/backup/sql/sanitized_inventory.sql" \
SANITIZED_INVENTORY_OUTPUT_FILE="$payload_dir/source-inventory.json" \
SANITIZED_INVENTORY_STDERR_FILE="$work_dir/source-inventory.stderr" \
    "$repo_root/scripts/backup/capture-sanitized-inventory.sh"

storage_object_count="$(jq -er '.storage.object_count' "$payload_dir/source-inventory.json")"

(
    cd "$payload_dir"
    sha256sum roles.sql schema.sql data.sql history-schema.sql history-data.sql source-inventory.json > SHA256SUMS
)

completed_at="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
supabase_cli_version="$(supabase --version | tr -d '\r\n')"

jq -n \
    --arg backup_id "$backup_id" \
    --arg source_project_ref "$SUPABASE_PRODUCTION_PROJECT_REF" \
    --arg source_commit "$source_commit" \
    --arg started_at "$started_at" \
    --arg completed_at "$completed_at" \
    --arg supabase_cli_version "$supabase_cli_version" \
    --argjson retention_days "$retention_days" \
    --argjson storage_object_count "$storage_object_count" \
    '{
        format_version: 1,
        backup_id: $backup_id,
        source_project_ref: $source_project_ref,
        source_commit: $source_commit,
        started_at_utc: $started_at,
        completed_at_utc: $completed_at,
        supabase_cli_version: $supabase_cli_version,
        restore_order: ["roles.sql", "schema.sql", "data.sql", "history-schema.sql", "history-data.sql"],
        contents: {
            roles: true,
            application_schema: true,
            data_including_auth_and_storage_metadata: true,
            migration_history: true,
            storage_object_bytes: false
        },
        storage_object_count_at_capture: $storage_object_count,
        retention_days: $retention_days
    }' > "$payload_dir/manifest.json"

(
    cd "$payload_dir"
    sha256sum manifest.json >> SHA256SUMS
)

tar -czf "$archive_path" -C "$payload_dir" .
age --recipient "$BACKUP_AGE_RECIPIENT" --output "$encrypted_path" "$archive_path"

encrypted_sha256="$(sha256sum "$encrypted_path" | awk '{print $1}')"
encrypted_bytes="$(wc -c < "$encrypted_path" | tr -d ' ')"

jq -n \
    --arg backup_id "$backup_id" \
    --arg source_project_ref "$SUPABASE_PRODUCTION_PROJECT_REF" \
    --arg source_commit "$source_commit" \
    --arg completed_at "$completed_at" \
    --arg encrypted_file "$(basename "$encrypted_path")" \
    --arg encrypted_sha256 "$encrypted_sha256" \
    --argjson encrypted_bytes "$encrypted_bytes" \
    --argjson retention_days "$retention_days" \
    --argjson storage_object_count "$storage_object_count" \
    '{
        format_version: 1,
        backup_id: $backup_id,
        source_project_ref: $source_project_ref,
        source_commit: $source_commit,
        completed_at_utc: $completed_at,
        encrypted_file: $encrypted_file,
        encrypted_sha256: $encrypted_sha256,
        encrypted_bytes: $encrypted_bytes,
        retention_days: $retention_days,
        storage_object_count_at_capture: $storage_object_count
    }' > "$receipt_path"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    {
        printf 'backup_id=%s\n' "$backup_id"
        printf 'encrypted_file=%s\n' "$encrypted_path"
        printf 'receipt_file=%s\n' "$receipt_path"
        printf 'encrypted_sha256=%s\n' "$encrypted_sha256"
    } >> "$GITHUB_OUTPUT"
fi

printf 'Encrypted backup created: %s (%s bytes, sha256 %s).\n' "$(basename "$encrypted_path")" "$encrypted_bytes" "$encrypted_sha256"
