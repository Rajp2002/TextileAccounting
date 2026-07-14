#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

required=(BACKUP_ENCRYPTED_FILE BACKUP_AGE_IDENTITY_FILE RESTORE_EVIDENCE_DIR)
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
restore_started_at="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
restore_started_epoch="$(date +%s)"
work_dir="$(mktemp -d)"
payload_dir="$work_dir/payload"
local_project_dir="$work_dir/disposable-supabase"
local_started=false

cleanup() {
    if [[ "$local_started" == true ]]; then
        supabase stop --workdir "$local_project_dir" --no-backup >/dev/null 2>&1 || true
    fi
    rm -rf "$work_dir"
}
trap cleanup EXIT

mkdir -p "$payload_dir" "$local_project_dir" "$RESTORE_EVIDENCE_DIR"

printf 'Decrypting the selected backup into an ephemeral workspace.\n'
age --decrypt \
    --identity "$BACKUP_AGE_IDENTITY_FILE" \
    --output "$work_dir/backup.tar.gz" \
    "$BACKUP_ENCRYPTED_FILE"
tar -xzf "$work_dir/backup.tar.gz" -C "$payload_dir"

for name in roles.sql schema.sql data.sql history-schema.sql history-data.sql source-inventory.json manifest.json SHA256SUMS; do
    if [[ ! -f "$payload_dir/$name" ]]; then
        printf 'Backup payload is missing required file %s.\n' "$name" >&2
        exit 3
    fi
done

(
    cd "$payload_dir"
    sha256sum --check SHA256SUMS
)

supabase init --workdir "$local_project_dir" --force >/dev/null
printf 'Starting a disposable local Supabase stack; production is not a restore target.\n'
supabase start \
    --workdir "$local_project_dir" \
    --exclude analytics,edge-runtime,functions,imgproxy,inbucket,realtime,studio,vector \
    >/dev/null
local_started=true

status_env="$(supabase status --workdir "$local_project_dir" --output env)"
restore_db_url="$(printf '%s\n' "$status_env" | sed -n 's/^DB_URL="\(.*\)"$/\1/p')"
if [[ -z "$restore_db_url" ]]; then
    printf 'Could not obtain the disposable database URL from Supabase CLI status.\n' >&2
    exit 4
fi

psql "$restore_db_url" --no-psqlrc --set ON_ERROR_STOP=1 --tuples-only --quiet --command 'select 1' >/dev/null

printf 'Applying the documented restore order: roles, schema, data, migration schema, migration data.\n'
psql "$restore_db_url" \
    --no-psqlrc \
    --single-transaction \
    --variable ON_ERROR_STOP=1 \
    --file "$payload_dir/roles.sql" \
    --file "$payload_dir/schema.sql" \
    --command 'SET session_replication_role = replica' \
    --file "$payload_dir/data.sql" \
    >/dev/null

psql "$restore_db_url" \
    --no-psqlrc \
    --single-transaction \
    --variable ON_ERROR_STOP=1 \
    --file "$payload_dir/history-schema.sql" \
    --file "$payload_dir/history-data.sql" \
    >/dev/null

psql "$restore_db_url" \
    --no-psqlrc \
    --set ON_ERROR_STOP=1 \
    --tuples-only \
    --quiet \
    --file "$repo_root/scripts/backup/sql/sanitized_inventory.sql" \
    > "$work_dir/restored-inventory.json"

jq --sort-keys . "$payload_dir/source-inventory.json" > "$work_dir/source-inventory.normalized.json"
jq --sort-keys . "$work_dir/restored-inventory.json" > "$work_dir/restored-inventory.normalized.json"
if ! cmp -s "$work_dir/source-inventory.normalized.json" "$work_dir/restored-inventory.normalized.json"; then
    printf 'Restored inventory does not exactly match the encrypted source inventory.\n' >&2
    jq -n \
        --arg status fail \
        --arg reason inventory_mismatch \
        --arg restore_started_at_utc "$restore_started_at" \
        '{status: $status, reason: $reason, restore_started_at_utc: $restore_started_at_utc}' \
        > "$RESTORE_EVIDENCE_DIR/restore-result.json"
    exit 5
fi

psql "$restore_db_url" --no-psqlrc --set ON_ERROR_STOP=1 --tuples-only --quiet --command 'select 1' >/dev/null

restore_completed_at="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
restore_completed_epoch="$(date +%s)"
recovery_seconds="$((restore_completed_epoch - restore_started_epoch))"
backup_id="$(jq -er '.backup_id' "$payload_dir/manifest.json")"
source_project_ref="$(jq -er '.source_project_ref' "$payload_dir/manifest.json")"
source_commit="$(jq -er '.source_commit' "$payload_dir/manifest.json")"
migration_head="$(jq -er '.migrations.head' "$work_dir/restored-inventory.json")"

jq -n \
    --arg status pass \
    --arg backup_id "$backup_id" \
    --arg source_project_ref "$source_project_ref" \
    --arg source_commit "$source_commit" \
    --arg restore_started_at_utc "$restore_started_at" \
    --arg restore_completed_at_utc "$restore_completed_at" \
    --arg migration_head "$migration_head" \
    --argjson recovery_seconds "$recovery_seconds" \
    --slurpfile inventory "$work_dir/restored-inventory.json" \
    '{
        status: $status,
        backup_id: $backup_id,
        source_project_ref: $source_project_ref,
        source_commit: $source_commit,
        restore_target: "ephemeral local Supabase stack",
        production_targeted: false,
        restore_started_at_utc: $restore_started_at_utc,
        restore_completed_at_utc: $restore_completed_at_utc,
        recovery_seconds: $recovery_seconds,
        database_start_check: "pass",
        restore_order_check: "pass",
        inventory_exact_match: true,
        migration_head: $migration_head,
        inventory: $inventory[0],
        cleanup: "performed by EXIT trap; Supabase stopped with --no-backup"
    }' > "$RESTORE_EVIDENCE_DIR/restore-result.json"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    {
        printf 'backup_id=%s\n' "$backup_id"
        printf 'recovery_seconds=%s\n' "$recovery_seconds"
        printf 'migration_head=%s\n' "$migration_head"
    } >> "$GITHUB_OUTPUT"
fi

printf 'Disposable restore verified in %s seconds; migration head %s. Cleanup will now run.\n' "$recovery_seconds" "$migration_head"
