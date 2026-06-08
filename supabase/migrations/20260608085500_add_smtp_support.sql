-- Add SMTP columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS smtp_host text, 
ADD COLUMN IF NOT EXISTS smtp_port integer, 
ADD COLUMN IF NOT EXISTS smtp_user text, 
ADD COLUMN IF NOT EXISTS smtp_pass text;
