#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

required=(
    SANITIZED_SOURCE_INVENTORY_FILE
    SANITIZED_RESTORED_INVENTORY_FILE
    SANITIZED_INVENTORY_COMPARISON_FILE
)
for name in "${required[@]}"; do
    if [[ -z "${!name:-}" ]]; then
        printf 'Required environment variable %s is not set.\n' "$name" >&2
        exit 2
    fi
done

for command_name in jq cmp mktemp mv rm mkdir dirname; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
        printf 'Required command %s is unavailable.\n' "$command_name" >&2
        exit 2
    fi
done

for inventory_file in "$SANITIZED_SOURCE_INVENTORY_FILE" "$SANITIZED_RESTORED_INVENTORY_FILE"; do
    if ! jq -e 'type == "object" and .format_version == 1' "$inventory_file" >/dev/null 2>&1; then
        printf 'Sanitized inventory comparison input is invalid.\n' >&2
        exit 3
    fi
done

comparison_dir="$(dirname "$SANITIZED_INVENTORY_COMPARISON_FILE")"
mkdir -p "$comparison_dir"
source_normalized="$(mktemp "$comparison_dir/source-inventory.XXXXXX")"
restored_normalized="$(mktemp "$comparison_dir/restored-inventory.XXXXXX")"
comparison_candidate="$(mktemp "$comparison_dir/inventory-comparison.XXXXXX")"

cleanup() {
    rm -f "$source_normalized" "$restored_normalized" "$comparison_candidate"
}
trap cleanup EXIT

jq --sort-keys . "$SANITIZED_SOURCE_INVENTORY_FILE" > "$source_normalized"
jq --sort-keys . "$SANITIZED_RESTORED_INVENTORY_FILE" > "$restored_normalized"

if cmp -s "$source_normalized" "$restored_normalized"; then
    jq -n '{exact_match: true, differences: null}' > "$comparison_candidate"
    mv "$comparison_candidate" "$SANITIZED_INVENTORY_COMPARISON_FILE"
    trap - EXIT
    rm -f "$source_normalized" "$restored_normalized"
    exit 0
fi

jq -n \
    --slurpfile source "$SANITIZED_SOURCE_INVENTORY_FILE" \
    --slurpfile restored "$SANITIZED_RESTORED_INVENTORY_FILE" '
    def safe_domain($entry):
        ($entry // {})
        | {
            rows: (.rows // null),
            organizations: (.organizations // null),
            null_org_rows: (.null_org_rows // null),
            orphan_org_rows: (.orphan_org_rows // null)
        };
    def domain_names($source_inventory; $restored_inventory):
        ((($source_inventory.domains // {}) | keys) + (($restored_inventory.domains // {}) | keys))
        | unique;
    ($source[0]) as $source_inventory
    | ($restored[0]) as $restored_inventory
    | {
        exact_match: false,
        differences: {
            domains: [
                domain_names($source_inventory; $restored_inventory)[] as $domain
                | (safe_domain($source_inventory.domains[$domain])) as $source_safe
                | (safe_domain($restored_inventory.domains[$domain])) as $restored_safe
                | {
                    domain: $domain,
                    source: $source_safe,
                    restored: $restored_safe,
                    identity_digest_match: (
                        ($source_inventory.domains[$domain].identity_digest // null)
                        == ($restored_inventory.domains[$domain].identity_digest // null)
                    )
                }
                | select(.source != .restored or (.identity_digest_match | not))
            ],
            auth: {
                source: (($source_inventory.auth // {}) | del(.identity_digest)),
                restored: (($restored_inventory.auth // {}) | del(.identity_digest)),
                identity_digest_match: (
                    ($source_inventory.auth.identity_digest // null)
                    == ($restored_inventory.auth.identity_digest // null)
                )
            },
            storage: {
                source: ($source_inventory.storage // {}),
                restored: ($restored_inventory.storage // {})
            },
            migrations: {
                source: ($source_inventory.migrations // {}),
                restored: ($restored_inventory.migrations // {})
            },
            extensions: {
                source: ($source_inventory.extensions // []),
                restored: ($restored_inventory.extensions // [])
            }
        }
    }
' > "$comparison_candidate"

mv "$comparison_candidate" "$SANITIZED_INVENTORY_COMPARISON_FILE"
trap - EXIT
rm -f "$source_normalized" "$restored_normalized"
exit 5
