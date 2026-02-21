const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env vars from .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim();
    }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase URL or Service Role Key in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function purgeData() {
    console.log('⚠️  STARTING DATA PURGE ⚠️');

    // 1. Delete from public tables (leaf nodes first to avoid FK constraint errors if cascade isn't set)
    console.log('-> Deleting public table data...');

    const tables = [
        'production_logs',
        'machine_assignments',
        'machines',
        'workers',
        'profiles',
        'organizations'
    ];

    for (const table of tables) {
        const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
        // Note: .delete().all() isn't valid, need a filter. id != nil UUID is a trick, or just greater than something.
        // Actually, better to use .neq('id', 0) if IDs are ints, or just a condition that is always true.
        // For UUIDs, .neq('id', '00000000-0000-0000-0000-000000000000') works.
        // But some tables might have int IDs.

        // Let's try to delete everything by using a condition that matches everything.
        // Or simpler: list IDs and delete them.

        // Actually, service_role allows us to truncate? No, API doesn't have truncate.
        // We have to delete.

        // Let's just try to delete all where id is not null.
        if (table === 'production_logs' || table === 'workers' || table === 'machine_assignments') {
            // Bigint IDs
            const { error: err } = await supabase.from(table).delete().gt('id', 0);
            if (err) console.error(`Error deleting ${table}:`, err.message);
            else console.log(`Cleared ${table}`);
        } else {
            // UUID IDs
            const { error: err } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (err) console.error(`Error deleting ${table}:`, err.message);
            else console.log(`Cleared ${table}`);
        }
    }

    // 2. Delete all Auth Users
    console.log('-> Deleting auth users...');

    // List all users
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (listError) {
        console.error('Error listing users:', listError);
        return;
    }

    console.log(`Found ${users.length} users.`);

    for (const user of users) {
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
        if (deleteError) {
            console.error(`Failed to delete user ${user.email}:`, deleteError.message);
        } else {
            console.log(`Deleted user ${user.email}`);
        }
    }

    console.log('✅ Purge completed.');
}

purgeData();
