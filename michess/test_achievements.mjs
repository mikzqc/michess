import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://azcgiieritmsabfomqow.supabase.co';
const supabaseAnonKey = 'sb_publishable_LGNAOAaNN43C0caiFD_VjQ_6atOakWA';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAuth() {
  const { data: { session }, error: sessionError } = await supabase.auth.signInWithPassword({
    email: 'mikhaelmathewszawar@gmail.com', // wait, I don't know their password. I can't log in.
    password: 'password123'
  });
  console.log('Session Error:', sessionError);
}

testAuth();
