import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://azcgiieritmsabfomqow.supabase.co', 'sb_publishable_LGNAOAaNN43C0caiFD_VjQ_6atOakWA');

async function test() {
  const { data, error } = await supabase.rpc('get_table_info', { table_name: 'profiles' });
  console.log(data, error);
}
test();
