/**
 * Cliente Supabase compartido por toda la aplicación.
 * Lee credenciales desde .env (variables VITE_*).
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[supabase] Falta configurar VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY en .env\n' +
    'Copiá .env.example a .env y completá los valores reales.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'sit_metalium_session'
  }
});
