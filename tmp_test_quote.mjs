import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzhwahudircrpgtitwzd.supabase.co';
const supabaseKey = '***REMOVED_JWT***';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    // 1. Get an active org
    const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
    if (!orgs || orgs.length === 0) return console.log('No orgs found');
    const org_id = orgs[0].id;

    // 2. Try to insert an estimator quote exactly as saveEstimatorQuoteV3 does
    const payload = {
        org_id:               org_id,
        party_name:           'Test Party',
        quality_label:        'Test Quality',
        warp_instruction:     'Test Warp',
        weft_instruction:     'Test Weft',
        warp_rows:            [{}],
        weft_rows:            [{}],
        per_pick_cost_paise:  0,
        tape_length_m:        0,
        warp_crimp_pct:       0,
        warping_rate_per_kg:  0,
        sizing_rate_per_kg:   0,
        winding_rate_per_kg:  0,
        processing_rate_per_m: 0,
        finishing_rate_per_m: 0,
        overhead_items:       [],
        monthly_output_m:     0,
        overhead_override_per_m: null,
        overhead_pct:         0,
        commission_pct:       0,
        transport_per_m:      0,
        order_quantity_m:     0,
        profit_margin_pct:    0,
        enabled_sections:     {},
        landed_cost_per_meter:    0,
        quote_price_per_meter:    0,
        intended_margin_percent:  0,
        meters:                   0,
        worker_rate_per_m:    0,
        ppi:     68,
        yarn_denier: 75,
        yarn_rate_per_kg: 0,
    };

    const { data, error } = await supabase.from('estimator_quotes').insert(payload).select('id');
    console.log('Result:', { data, error });
}

test();
