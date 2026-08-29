
CREATE TABLE public.verification_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'signup',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow edge functions to manage verification codes"
  ON public.verification_codes FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_verification_codes_email_type ON public.verification_codes (email, type, used);
