-- Produces a single JSON document containing counts and pseudonymous identity
-- digests only. It intentionally excludes names, emails, phones, amounts,
-- free-text notes, and object paths. The document is stored inside the
-- encrypted backup payload and is used to reconcile a disposable restore.
WITH domain_rows AS (
    SELECT
        'organizations'::text AS domain,
        count(*)::bigint AS row_count,
        count(*)::bigint AS organization_count,
        0::bigint AS null_org_count,
        0::bigint AS orphan_org_count,
        encode(extensions.digest(coalesce(string_agg(o.id::text, ',' ORDER BY o.id::text), '<empty>'), 'sha256'), 'hex') AS identity_digest
    FROM public.organizations o

    UNION ALL

    SELECT
        'users', count(*), count(DISTINCT p.org_id),
        count(*) FILTER (WHERE p.org_id IS NULL),
        count(*) FILTER (WHERE p.org_id IS NOT NULL AND o.id IS NULL),
        encode(extensions.digest(coalesce(string_agg(concat_ws(':', p.id::text, p.org_id::text), ',' ORDER BY p.id::text), '<empty>'), 'sha256'), 'hex')
    FROM public.profiles p
    LEFT JOIN public.organizations o ON o.id = p.org_id

    UNION ALL

    SELECT
        'estimator', count(*), count(DISTINCT q.org_id),
        count(*) FILTER (WHERE q.org_id IS NULL),
        count(*) FILTER (WHERE q.org_id IS NOT NULL AND o.id IS NULL),
        encode(extensions.digest(coalesce(string_agg(concat_ws(':', q.id::text, q.org_id::text), ',' ORDER BY q.id::text), '<empty>'), 'sha256'), 'hex')
    FROM public.estimator_quotes q
    LEFT JOIN public.organizations o ON o.id = q.org_id

    UNION ALL

    SELECT
        'orders', count(*), count(DISTINCT x.org_id),
        count(*) FILTER (WHERE x.org_id IS NULL),
        count(*) FILTER (WHERE x.org_id IS NOT NULL AND o.id IS NULL),
        encode(extensions.digest(coalesce(string_agg(concat_ws(':', x.id::text, x.org_id::text), ',' ORDER BY x.id::text), '<empty>'), 'sha256'), 'hex')
    FROM public.orders x
    LEFT JOIN public.organizations o ON o.id = x.org_id

    UNION ALL

    SELECT
        'production', count(*), count(DISTINCT x.org_id),
        count(*) FILTER (WHERE x.org_id IS NULL),
        count(*) FILTER (WHERE x.org_id IS NOT NULL AND o.id IS NULL),
        encode(extensions.digest(coalesce(string_agg(concat_ws(':', x.id::text, x.org_id::text), ',' ORDER BY x.id::text), '<empty>'), 'sha256'), 'hex')
    FROM public.production_logs x
    LEFT JOIN public.organizations o ON o.id = x.org_id

    UNION ALL

    SELECT
        'stock', count(*), count(DISTINCT x.org_id),
        count(*) FILTER (WHERE x.org_id IS NULL),
        count(*) FILTER (WHERE x.org_id IS NOT NULL AND o.id IS NULL),
        encode(extensions.digest(coalesce(string_agg(concat_ws(':', x.id::text, x.org_id::text), ',' ORDER BY x.id::text), '<empty>'), 'sha256'), 'hex')
    FROM public.fabric_stock_lots x
    LEFT JOIN public.organizations o ON o.id = x.org_id

    UNION ALL

    SELECT
        'receivables', count(*), count(DISTINCT x.org_id),
        count(*) FILTER (WHERE x.org_id IS NULL),
        count(*) FILTER (WHERE x.org_id IS NOT NULL AND o.id IS NULL),
        encode(extensions.digest(coalesce(string_agg(concat_ws(':', x.id::text, x.org_id::text), ',' ORDER BY x.id::text), '<empty>'), 'sha256'), 'hex')
    FROM public.commercial_receivables x
    LEFT JOIN public.organizations o ON o.id = x.org_id

    UNION ALL

    SELECT
        'payroll', count(*), count(DISTINCT x.org_id),
        count(*) FILTER (WHERE x.org_id IS NULL),
        count(*) FILTER (WHERE x.org_id IS NOT NULL AND o.id IS NULL),
        encode(extensions.digest(coalesce(string_agg(concat_ws(':', x.id::text, x.org_id::text), ',' ORDER BY x.id::text), '<empty>'), 'sha256'), 'hex')
    FROM public.payroll_settlements x
    LEFT JOIN public.organizations o ON o.id = x.org_id
),
auth_counts AS (
    SELECT jsonb_build_object(
        'users', (SELECT count(*) FROM auth.users),
        'identities', (SELECT count(*) FROM auth.identities),
        'sessions', (SELECT count(*) FROM auth.sessions),
        'refresh_tokens', (SELECT count(*) FROM auth.refresh_tokens),
        'users_without_profile', (
            SELECT count(*)
            FROM auth.users u
            LEFT JOIN public.profiles p ON p.id = u.id
            WHERE p.id IS NULL
        ),
        'profiles_without_auth_user', (
            SELECT count(*)
            FROM public.profiles p
            LEFT JOIN auth.users u ON u.id = p.id
            WHERE u.id IS NULL
        ),
        'identity_digest', (
            SELECT encode(extensions.digest(coalesce(string_agg(u.id::text, ',' ORDER BY u.id::text), '<empty>'), 'sha256'), 'hex')
            FROM auth.users u
        )
    ) AS value
),
storage_counts AS (
    SELECT jsonb_build_object(
        'buckets', (SELECT count(*) FROM storage.buckets),
        'objects', (SELECT count(*) FROM storage.objects),
        'bytes', (
            SELECT coalesce(sum(
                CASE
                    WHEN coalesce(metadata ->> 'size', '') ~ '^[0-9]+$'
                    THEN (metadata ->> 'size')::bigint
                    ELSE 0
                END
            ), 0)
            FROM storage.objects
        )
    ) AS value
),
migration_state AS (
    SELECT jsonb_build_object(
        'count', count(*),
        'head', max(version)
    ) AS value
    FROM supabase_migrations.schema_migrations
),
extension_state AS (
    SELECT coalesce(
        jsonb_agg(jsonb_build_object('name', extname, 'version', extversion) ORDER BY extname),
        '[]'::jsonb
    ) AS value
    FROM pg_extension
)
SELECT jsonb_pretty(jsonb_build_object(
    'format_version', 1,
    'domains', (
        SELECT jsonb_object_agg(
            domain,
            jsonb_build_object(
                'rows', row_count,
                'organizations', organization_count,
                'null_org_rows', null_org_count,
                'orphan_org_rows', orphan_org_count,
                'identity_digest', identity_digest
            )
            ORDER BY domain
        )
        FROM domain_rows
    ),
    'auth', (SELECT value FROM auth_counts),
    'storage', (SELECT value FROM storage_counts),
    'migrations', (SELECT value FROM migration_state),
    'extensions', (SELECT value FROM extension_state)
));
