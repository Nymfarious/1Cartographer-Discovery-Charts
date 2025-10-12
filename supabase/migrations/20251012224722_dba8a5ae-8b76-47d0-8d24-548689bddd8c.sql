-- Create request logs table for rate limiting
CREATE TABLE public.request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  response_time_ms INTEGER
);

-- Index for fast rate limit queries
CREATE INDEX idx_request_logs_user_endpoint 
ON public.request_logs(user_id, endpoint, created_at);

-- Enable RLS
ALTER TABLE public.request_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own logs
CREATE POLICY "Users can view their own request logs"
ON public.request_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Auto-delete old logs to prevent table bloat (keep 1 hour)
CREATE OR REPLACE FUNCTION delete_old_request_logs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.request_logs
  WHERE created_at < now() - interval '1 hour';
  RETURN NEW;
END;
$$;

CREATE TRIGGER cleanup_request_logs
AFTER INSERT ON public.request_logs
EXECUTE FUNCTION delete_old_request_logs();