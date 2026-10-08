import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://azcgiieritmsabfomqow.supabase.co', 'sb_publishable_LGNAOAaNN43C0caiFD_VjQ_6atOakWA');

async function test() {
  const { data, error } = await supabase.from('profiles').select('rating_bullet, highest_rating').limit(1);
  console.log(data, error);
}
test();
