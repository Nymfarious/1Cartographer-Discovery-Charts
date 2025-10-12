import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

interface RateLimitConfig {
  requests: number;
  window: number; // in seconds
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'historian-qa': { requests: 10, window: 60 },
  'overlay-artist': { requests: 5, window: 60 },
  'text-to-speech': { requests: 20, window: 60 },
};

export async function checkRateLimit(
  userId: string,
  endpoint: string,
  supabase: any
): Promise<{ allowed: boolean; remaining: number; error?: string }> {
  const limit = RATE_LIMITS[endpoint];
  
  if (!limit) {
    return { allowed: true, remaining: 999 };
  }

  const now = Date.now();
  const windowStart = new Date(now - limit.window * 1000).toISOString();

  try {
    const { data, error } = await supabase
      .from('request_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .gte('created_at', windowStart);

    if (error) {
      console.error('[RATE-LIMIT] Error checking rate limit:', error.name);
      return { allowed: true, remaining: 999 };
    }

    const count = data?.length || 0;
    const remaining = Math.max(0, limit.requests - count);

    return {
      allowed: count < limit.requests,
      remaining,
    };
  } catch (error) {
    console.error('[RATE-LIMIT] Exception:', error instanceof Error ? error.name : 'Unknown');
    return { allowed: true, remaining: 999 };
  }
}

export async function logRequest(
  userId: string,
  endpoint: string,
  supabase: any
): Promise<void> {
  try {
    await supabase.from('request_logs').insert({
      user_id: userId,
      endpoint: endpoint,
    });
  } catch (error) {
    console.error('[RATE-LIMIT] Failed to log request:', error instanceof Error ? error.name : 'Unknown');
  }
}
