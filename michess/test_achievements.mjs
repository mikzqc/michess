import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://azcgiieritmsabfomqow.supabase.co';
const supabaseAnonKey = 'sb_publishable_LGNAOAaNN43C0caiFD_VjQ_6atOakWA';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAuth() {
  const { data: profile } = await supabase.from('profiles').select('*').limit(1).single();
  console.log('Profile:', profile);
}

testAuth();
