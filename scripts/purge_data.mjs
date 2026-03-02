import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../supabase/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("Missing Supabase URL or Service Role Key in supabase/.env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function purgeData() {
    console.log("Starting data purge...");

    const tablesToClear = [
        'production_logs',
        'machine_assignments',
        'machines',
        'workers',
        'profiles',
        'organizations'
    ];

    for (const table of tablesToClear) {
        console.log(`Clearing table: ${table}`);
        try {
            // To clear table using Supabase client without a WHERE clause, 
            // we can select all IDs and then delete, or use a not equal filter.
            // Easiest is to delete where id is not null. A non-existent table will just error, which we catch.
            const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000').neq('id', 0).neq('id', 'some-non-existent-id');
            if (error) {
                // We try a generic approach if id type is different
                const res = await supabase.from(table).select('id').limit(1000);
                if (res.data) {
                    const ids = res.data.map(r => r.id);
                    if (ids.length > 0) {
                        await supabase.from(table).delete().in('id', ids);
                    }
                }
            }
        } catch (err) {
            console.log(`Skipped or failed clearing ${table}: ${err.message}`);
        }
    }

    // Also delete all users via Admin API
    console.log("Fetching auth.users...");
    let hasMore = true;
    let page = 1;

    while (hasMore) {
        const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({
            page,
            perPage: 1000
        });

        if (listError) {
            console.error("Error listing users:", listError.message);
            break;
        }

        const users = usersData.users;
        if (users.length === 0) {
            hasMore = false;
            break;
        }

        console.log(`Found ${users.length} users to delete...`);
        for (const user of users) {
            const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
            if (delError) {
                console.error(`Failed to delete user ${user.id}: ${delError.message}`);
            } else {
                console.log(`Deleted user ${user.email} (${user.id})`);
            }
        }

        if (users.length < 1000) {
            hasMore = false;
        } else {
            page++;
        }
    }

    console.log("Purge complete!");
}

purgeData().catch(console.error);
