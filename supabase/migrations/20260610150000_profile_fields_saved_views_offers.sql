-- Migration: Add profile fields, saved views, and offer library

-- 1. Add fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS workspace_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role_title text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Create Saved Views table
CREATE TABLE IF NOT EXISTS public.saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  filters jsonb DEFAULT '{}'::jsonb NOT NULL,
  is_default boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own saved views" ON public.saved_views
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS saved_views_user_id_idx ON public.saved_views(user_id);

-- 3. Create Offers table
CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  details text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own offers" ON public.offers
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS offers_user_id_idx ON public.offers(user_id);

-- 4. Add offer_id to email_templates_library
ALTER TABLE public.email_templates_library ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL;

-- 5. Add reply_outcome to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS reply_outcome text;
