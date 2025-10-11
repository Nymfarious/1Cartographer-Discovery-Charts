-- Create app role enum
CREATE TYPE public.app_role AS ENUM ('user', 'admin');

-- Create profiles table (basic user info)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Create posters library table
CREATE TABLE IF NOT EXISTS public.posters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  credit TEXT,
  license_status TEXT NOT NULL CHECK (license_status IN ('demo_only', 'licensed', 'public_domain')),
  dzi_path TEXT NOT NULL,
  thumb_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create hotspots table (per poster)
CREATE TABLE IF NOT EXISTS public.hotspots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id UUID NOT NULL REFERENCES public.posters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  snippet TEXT,
  x NUMERIC NOT NULL CHECK (x >= 0 AND x <= 1),
  y NUMERIC NOT NULL CHECK (y >= 0 AND y <= 1),
  zoom NUMERIC,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotspots ENABLE ROW LEVEL SECURITY;

-- Profiles policies: users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- User roles policies: users can view their own roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can manage roles
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Posters policies: authenticated users can read
CREATE POLICY "Authenticated users can view posters"
  ON public.posters FOR SELECT
  TO authenticated
  USING (true);

-- Admins can manage posters
CREATE POLICY "Admins can insert posters"
  ON public.posters FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update posters"
  ON public.posters FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete posters"
  ON public.posters FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Hotspots policies: authenticated users can read
CREATE POLICY "Authenticated users can view hotspots"
  ON public.hotspots FOR SELECT
  TO authenticated
  USING (true);

-- Admins can manage hotspots
CREATE POLICY "Admins can insert hotspots"
  ON public.hotspots FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update hotspots"
  ON public.hotspots FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete hotspots"
  ON public.hotspots FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create storage bucket for tiles (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tiles', 'tiles', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for tiles bucket
CREATE POLICY "Authenticated users can view tiles"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'tiles');

CREATE POLICY "Admins can upload tiles"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'tiles' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update tiles"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'tiles' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete tiles"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'tiles' AND public.has_role(auth.uid(), 'admin'));