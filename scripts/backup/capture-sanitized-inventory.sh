#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

required=(
    SANITIZED_INVENTORY_DB_URL
    SANITIZED_INVENTORY_SQL_FILE
    SANITIZED_INVENTORY_OUTPUT_FILE
    SANITIZED_INVENTORY_STDERR_FILE
)
for name in "${required[@]}"; do
    if [[ -z "${!name:-}" ]]; then
        printf 'Required environment variable %s is not set.\n' "$name" >&2
        exit 2
    fi
done

for command_name in psql jq mv rm; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
        printf 'Required command %s is unavailable.\n' "$command_name" >&2
        exit 2
    fi
done

candidate_file="${SANITIZED_INVENTORY_OUTPUT_FILE}.candidate.$$"
cleanup() {
    rm -f "$candidate_file"
}
trap cleanup EXIT

if ! psql "$SANITIZED_INVENTORY_DB_URL" \
    --no-psqlrc \
    --tuples-only \
    --no-align \
    --quiet \
    --set ON_ERROR_STOP=1 \
    --file "$SANITIZED_INVENTORY_SQL_FILE" \
    > "$candidate_file" \
    2> "$SANITIZED_INVENTORY_STDERR_FILE"; then
    printf 'Sanitized inventory query failed; database output was withheld and no artifact will be created.\n' >&2
    exit 4
fi

if ! jq -e -s '
    length == 1 and
    (.[0] |
        type == "object" and
        .format_version == 1 and
        (.domains | type == "object") and
        (.auth | type == "object") and
        (.storage | type == "object") and
        (.migrations | type == "object") and
        (.extensions | type == "array") and
        (.storage.bucket_count | type == "number" and . >= 0 and floor == .) and
        (.storage.object_count | type == "number" and . >= 0 and floor == .) and
        (.storage.total_bytes | type == "number" and . >= 0 and floor == .)
    )
' "$candidate_file" >/dev/null 2>&1; then
    printf 'Sanitized inventory validation failed; output was not valid expected JSON and no artifact will be created.\n' >&2
    exit 5
fi

if ! jq -e '
    .storage.bucket_count == 0 and
    .storage.object_count == 0 and
    .storage.total_bytes == 0
' "$candidate_file" >/dev/null 2>&1; then
    printf 'Storage inventory is non-zero; object-byte export is not configured and no artifact will be created.\n' >&2
    exit 3
fi

mv "$candidate_file" "$SANITIZED_INVENTORY_OUTPUT_FILE"
trap - EXIT
printf 'Sanitized Storage inventory validated: zero buckets, zero objects, zero bytes.\n'
