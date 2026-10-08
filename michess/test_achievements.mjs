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
  console.log('SignUp Data:', data);
  console.log('SignUp Error:', error);
}

testAuth();
