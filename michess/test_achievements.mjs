import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://azcgiieritmsabfomqow.supabase.co';
const supabaseAnonKey = 'sb_publishable_LGNAOAaNN43C0caiFD_VjQ_6atOakWA';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAuth() {
  const email = 'testuser_' + Date.now() + '@example.com';
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password: 'password123',
    options: {
      data: {
        username: 'test_' + Date.now()
      }
    }
  });

  if (!authData?.user) return;
  // I can't check RLS unless I can actually get a session!
  // Since email confirmation is ON, I can't get a session programmatically.
}
testAuth();
