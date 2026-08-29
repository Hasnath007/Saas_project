/**
 * Call Supabase Edge Functions directly
 * Pure vanilla fetch - no client middleware
 */
export async function invokeFunction<T = any>(
  functionName: string,
  body: any
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
    const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY");
    }

    // Build URL without any trailing slashes
    const url = supabaseUrl.replace(/\/$/, '') + `/functions/v1/${functionName}`;
    
    console.log(`Calling: ${url}`);
    console.log(`Auth: apikey ${supabaseKey.slice(0, 15)}...`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
      },
      body: JSON.stringify(body),
    });

    let data: any;
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    console.log(`Response ${response.status}:`, data);

    if (!response.ok) {
      throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
    }

    return { data, error: null };
  } catch (err: any) {
    console.error(`Function error:`, err.message);
    return { data: null, error: err };
  }
}
