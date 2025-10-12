# Security Implementation Plan - Steps 5-7

## Overview
Priority actions 1-4 have been completed:
- ✅ Edge functions secured (JWT verification re-enabled)
- ✅ Profiles table RLS policies fixed (UPDATE/DELETE added)
- ✅ Input validation implemented with Zod schemas
- ✅ Auth configuration updated

## Remaining Implementation Steps

### Step 5: Reduce Verbose Error Logging in Edge Functions

**Risk Level:** Medium  
**Impact:** Prevents information disclosure that could help attackers understand system internals

**Current Issue:**
Edge functions log detailed error information including:
- Stack traces
- Internal system paths
- API response details
- Database query errors

**Implementation Plan:**

1. **Update `supabase/functions/historian-qa/index.ts`:**
   ```typescript
   // Current - Too verbose
   catch (error) {
     console.error('AI gateway error:', response.status, errorText);
     return new Response(JSON.stringify({ 
       error: error instanceof Error ? error.message : 'Unknown error' 
     }), ...);
   }
   
   // Improved - Sanitized errors
   catch (error) {
     // Log full details server-side only (for debugging)
     console.error('[HISTORIAN] Error occurred:', error instanceof Error ? error.name : 'Unknown');
     
     // Return generic message to client
     return new Response(JSON.stringify({ 
       error: 'Unable to process historical query. Please try again.' 
     }), { status: 500, headers: corsHeaders });
   }
   ```

2. **Update `supabase/functions/overlay-artist/index.ts`:**
   - Similar error sanitization pattern
   - Log error codes only, not full messages
   - Return user-friendly error messages

3. **Update `supabase/functions/text-to-speech/index.ts`:**
   - Sanitize ElevenLabs API errors
   - Don't expose API key validation errors
   - Generic "speech generation failed" message

4. **Create Error Handling Utility:**
   ```typescript
   // Create: supabase/functions/_shared/errorHandler.ts
   export function sanitizeError(error: unknown, context: string): string {
     console.error(`[${context}] Error:`, error instanceof Error ? error.name : 'Unknown');
     return 'An error occurred while processing your request.';
   }
   ```

**Testing:**
- Trigger errors deliberately
- Verify client receives generic messages
- Confirm server logs still contain debug info
- Check network tab for information leakage

---

### Step 6: Implement Rate Limiting and Request Validation

**Risk Level:** High  
**Impact:** Prevents abuse of AI endpoints and resource exhaustion

**Current Issue:**
Edge functions with JWT enabled are still vulnerable to:
- Authenticated users making excessive requests
- Draining AI credits through rapid-fire calls
- DoS attacks from compromised accounts

**Implementation Plan:**

1. **Add Rate Limiting to Edge Functions:**
   
   Create a rate limiting utility:
   ```typescript
   // supabase/functions/_shared/rateLimit.ts
   import { createClient } from '@supabase/supabase-js';
   
   const RATE_LIMITS = {
     'historian-qa': { requests: 10, window: 60 }, // 10 req/min
     'overlay-artist': { requests: 5, window: 60 }, // 5 req/min
     'text-to-speech': { requests: 20, window: 60 }, // 20 req/min
   };
   
   export async function checkRateLimit(
     userId: string,
     endpoint: string,
     supabase: SupabaseClient
   ): Promise<{ allowed: boolean; remaining: number }> {
     const limit = RATE_LIMITS[endpoint];
     const now = Date.now();
     const windowStart = now - (limit.window * 1000);
     
     // Query request log (need to create this table)
     const { data, error } = await supabase
       .from('request_logs')
       .select('id')
       .eq('user_id', userId)
       .eq('endpoint', endpoint)
       .gte('created_at', new Date(windowStart).toISOString());
     
     const count = data?.length || 0;
     const remaining = Math.max(0, limit.requests - count);
     
     return {
       allowed: count < limit.requests,
       remaining
     };
   }
   ```

2. **Create Request Logs Table (Migration):**
   ```sql
   CREATE TABLE public.request_logs (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL,
     endpoint TEXT NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
     response_time_ms INTEGER
   );
   
   CREATE INDEX idx_request_logs_user_endpoint 
   ON public.request_logs(user_id, endpoint, created_at);
   
   -- Auto-delete old logs (keep 1 hour)
   CREATE OR REPLACE FUNCTION delete_old_request_logs()
   RETURNS trigger AS $$
   BEGIN
     DELETE FROM public.request_logs
     WHERE created_at < now() - interval '1 hour';
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   
   CREATE TRIGGER cleanup_request_logs
   AFTER INSERT ON public.request_logs
   EXECUTE FUNCTION delete_old_request_logs();
   ```

3. **Update Edge Functions to Use Rate Limiting:**
   ```typescript
   // In each edge function
   import { checkRateLimit } from '../_shared/rateLimit.ts';
   
   // After JWT verification
   const { allowed, remaining } = await checkRateLimit(
     user.id, 
     'historian-qa',
     supabase
   );
   
   if (!allowed) {
     return new Response(JSON.stringify({
       error: 'Rate limit exceeded. Please try again later.',
       remaining: 0
     }), { status: 429, headers: corsHeaders });
   }
   
   // Log the request
   await supabase.from('request_logs').insert({
     user_id: user.id,
     endpoint: 'historian-qa'
   });
   ```

**Testing:**
- Make rapid requests and verify rate limiting kicks in
- Check 429 responses are returned correctly
- Verify logs are created and cleaned up
- Test across different endpoints

---

### Step 7: Comprehensive Security Hardening

**Risk Level:** Medium to High  
**Impact:** Defense-in-depth improvements

#### 7.1: Storage Bucket Security Audit

**Action Items:**
1. Review `base_maps` bucket (currently public)
   - Should authenticated users see all base maps?
   - Consider user-specific folders
   - Add RLS-style policies if needed

2. Review `overlays` bucket (currently public)
   - Similar considerations as base_maps
   - May want to restrict overlay visibility

3. Review `tiles` bucket (private)
   - Verify signed URLs are working correctly
   - Check expiration times (currently 10 min - is this sufficient?)
   - Ensure no public access leaks

**Implementation:**
```sql
-- Add bucket-level policies if needed
CREATE POLICY "Users can view their own base maps"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'base_maps' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can upload to their folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'base_maps'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

#### 7.2: Admin Role Security

**Current Implementation:**
- Admin role stored in `user_roles` table ✅
- Uses security definer function `has_role()` ✅

**Additional Hardening:**
1. **Audit Admin Actions:**
   ```sql
   CREATE TABLE public.admin_audit_log (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     admin_user_id UUID NOT NULL,
     action TEXT NOT NULL,
     target_table TEXT,
     target_id UUID,
     details JSONB,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
   );
   
   -- Log admin operations via triggers on sensitive tables
   CREATE FUNCTION log_admin_action()
   RETURNS TRIGGER AS $$
   BEGIN
     INSERT INTO public.admin_audit_log (
       admin_user_id, action, target_table, target_id, details
     ) VALUES (
       auth.uid(),
       TG_OP,
       TG_TABLE_NAME,
       COALESCE(NEW.id, OLD.id),
       jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
     );
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```

2. **Admin Session Timeout:**
   - Consider shorter JWT expiration for admin users
   - Add re-authentication for sensitive operations

#### 7.3: Client-Side Security

**Action Items:**

1. **Remove Console Logs in Production:**
   ```typescript
   // Add to vite.config.ts
   export default defineConfig({
     esbuild: {
       drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
     },
   });
   ```

2. **Content Security Policy:**
   ```html
   <!-- Add to index.html -->
   <meta http-equiv="Content-Security-Policy" 
         content="default-src 'self'; 
                  script-src 'self' 'unsafe-inline'; 
                  style-src 'self' 'unsafe-inline'; 
                  img-src 'self' data: https:; 
                  connect-src 'self' https://*.supabase.co https://ai.gateway.lovable.dev;">
   ```

3. **Secure Local Storage:**
   ```typescript
   // Never store sensitive data in localStorage
   // Current usage is acceptable (theme colors, non-sensitive prefs)
   // But audit and document what should/shouldn't be stored
   ```

4. **HTTPS Enforcement:**
   - Verify production deployment uses HTTPS only
   - Add HSTS headers if not already present

#### 7.4: Database Security

**Action Items:**

1. **Review All RLS Policies:**
   - ✅ base_maps - Admin only write, authenticated read
   - ✅ chat_history - User-specific
   - ✅ hotspots - Admin write, authenticated read
   - ✅ overlays - Admin write, authenticated read
   - ✅ posters - Admin write, authenticated read
   - ✅ profiles - User-specific (now includes UPDATE)
   - ✅ trusted_sources - Admin write, public read
   - ✅ user_roles - Admin write, user read own

2. **Add Database Triggers for Data Validation:**
   ```sql
   -- Example: Validate email format at database level
   CREATE FUNCTION validate_profile_email()
   RETURNS TRIGGER AS $$
   BEGIN
     IF NEW.secondary_email IS NOT NULL AND 
        NEW.secondary_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' 
     THEN
       RAISE EXCEPTION 'Invalid email format';
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   
   CREATE TRIGGER check_profile_email
   BEFORE INSERT OR UPDATE ON public.profiles
   FOR EACH ROW EXECUTE FUNCTION validate_profile_email();
   ```

#### 7.5: Monitoring and Alerting

**Implementation:**

1. **Track Failed Authentication Attempts:**
   ```sql
   CREATE TABLE public.auth_failures (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     email TEXT,
     ip_address TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
   );
   
   CREATE INDEX idx_auth_failures_recent 
   ON public.auth_failures(created_at);
   ```

2. **Monitor Edge Function Usage:**
   - Use Supabase analytics dashboard
   - Set up alerts for unusual patterns
   - Track error rates

3. **Database Query Performance:**
   - Add indexes where needed
   - Monitor slow queries
   - Review RLS policy performance

---

## Implementation Priority

### Immediate (Next Sprint):
1. **Step 5** - Reduce error logging verbosity (2-3 hours)
2. **Step 6** - Implement rate limiting (4-6 hours)

### Short Term (Within 2 Weeks):
3. **Step 7.1** - Storage bucket security audit (2-3 hours)
4. **Step 7.2** - Admin role hardening (3-4 hours)

### Medium Term (Within 1 Month):
5. **Step 7.3** - Client-side security improvements (2-3 hours)
6. **Step 7.4** - Database security enhancements (4-5 hours)

### Ongoing:
7. **Step 7.5** - Monitoring and alerting setup (ongoing)

---

## Success Criteria

- [ ] No sensitive information in error messages
- [ ] Rate limiting prevents abuse of AI endpoints
- [ ] Storage buckets follow principle of least privilege
- [ ] Admin actions are audited
- [ ] CSP headers prevent XSS attacks
- [ ] All database operations validated at multiple levels
- [ ] Security monitoring alerts on suspicious activity

---

## Testing Plan

### Unit Tests:
- Validation schema edge cases
- Rate limiting logic
- Error sanitization

### Integration Tests:
- Full authentication flow
- Admin operations with audit logs
- Storage bucket access patterns

### Security Tests:
- Penetration testing of auth endpoints
- Rate limit bypass attempts
- SQL injection attempts (should be blocked by Supabase client)
- XSS attempts (should be blocked by CSP)

---

## Rollback Plan

Each step should be implemented with a migration that can be rolled back:
- Rate limiting: Can disable by removing rate checks
- Error logging: Can revert to verbose if needed for debugging
- Storage policies: Can be relaxed if too restrictive
- All database changes: Use Supabase migrations for version control
