// =====================================================
// Supabase Configuration Template
// =====================================================
// Copy this file to: supabase.config.js
// Then replace the placeholder values with your actual Supabase credentials
// NEVER commit supabase.config.js to version control!

const SUPABASE_CONFIG = {
  url: 'YOUR_SUPABASE_PROJECT_URL',        // e.g., https://xxxxx.supabase.co
  anonKey: 'YOUR_SUPABASE_ANON_KEY',       // Your public anon key
  options: {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: { 'x-application-name': 'nadi-calendar' }
    }
  }
};

// Initialize Supabase client
if (typeof window.supabaseClient === 'undefined' && typeof window.supabase !== 'undefined') {
  window.supabaseClient = window.supabase.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey,
    SUPABASE_CONFIG.options
  );
}
