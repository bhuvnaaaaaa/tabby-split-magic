CREATE TABLE public.tabby_ai_circuit_state (
  id text PRIMARY KEY,
  status integer NOT NULL,
  message text NOT NULL,
  blocked_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tabby_ai_circuit_state TO service_role;
ALTER TABLE public.tabby_ai_circuit_state ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.tabby_ai_circuit_state IS 'Service-only persistent AI access and credit pause state. No user notes or expenses are stored. Clear only after owner-confirmed recovery.';