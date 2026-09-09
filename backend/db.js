require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MONTHLY_PRICE_DT = 400;
const GRACE_DAYS = 7;

module.exports = { supabase, MONTHLY_PRICE_DT, GRACE_DAYS };
