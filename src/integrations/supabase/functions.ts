/**
 * Direct Edge Function caller
 * Bypasses Supabase JS SDK URL construction issues
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Edge Functions Config missing:', {
    urlExists: !!SUPABASE_URL,
    keyExists: !!SUPABASE_ANON_KEY,
    url: SUPABASE_URL,
  });
}

export async function invokeEdgeFunction<T = any>(
  functionName: string,
  body?: Record<string, any>
): Promise<{ data: T | null; error: Error | null }> {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase URL or API key not configured');
    }

    const url = `${SUPABASE_URL}/functions/v1/${functionName}`;
    const apiKey = SUPABASE_ANON_KEY;
    
    console.log(`🚀 Calling ${functionName}:`, {
      url,
      apiKeyFirst8: apiKey.substring(0, 8),
    });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify(body || {}),
    });

    console.log(`✅ Response status for ${functionName}: ${response.status}`);

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch (e) {
        const text = await response.text();
        console.log(`Response body (text): ${text}`);
      }
      throw new Error(errorData.error || `Function returned ${response.status}`);
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error('❌ Edge function error:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
