import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://azcgiieritmsabfomqow.supabase.co';
const supabaseAnonKey = 'sb_publishable_LGNAOAaNN43C0caiFD_VjQ_6atOakWA';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAuth() {
  const email = 'testuser_' + Date.now() + '@example.com';
  const { data, error } = await supabase.auth.signUp({
    email,
    password: 'password123'
  });
  
  // wait 2 seconds for trigger
  await new Promise(r => setTimeout(r, 2000));
  
  const { data: profile } = await supabase.from('profiles').select('highest_rating, games_played').eq('id', data.user.id).single();
  console.log('Profile:', profile);
}

testAuth();
