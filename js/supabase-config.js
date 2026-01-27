// ========================================
// Supabase Configuration
// ========================================

const SUPABASE_URL = 'https://tzyelxvrutltxoygiety.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6eWVseHZydXRsdHhveWdpZXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NzY2NzAsImV4cCI6MjA4NTA1MjY3MH0.fR6wa9UA8sNobNbCYV6XGBz4d0k-QLRieDSuAYXVqhI';

// Initialize Supabase client - SDK v2 uses supabase.createClient
let supabaseClient;

try {
    // Check if supabase SDK is loaded
    if (typeof supabase !== 'undefined' && supabase.createClient) {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase client initialized');
    } else {
        throw new Error('Supabase SDK not loaded');
    }
} catch (error) {
    console.error('❌ Error initializing Supabase:', error);
    // Create a mock client for fallback
    supabaseClient = null;
}

// Export for use in other modules
window.supabaseClient = supabaseClient;
