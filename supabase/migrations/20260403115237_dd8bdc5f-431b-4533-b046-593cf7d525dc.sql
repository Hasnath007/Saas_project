
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender TEXT NOT NULL DEFAULT 'property_manager',
  channel TEXT NOT NULL DEFAULT 'email',
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages for their tenants"
  ON public.messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tenants
    WHERE tenants.id = messages.tenant_id
    AND EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = tenants.property_id
      AND properties.user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can create messages for their tenants"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = messages.tenant_id
      AND EXISTS (
        SELECT 1 FROM properties
        WHERE properties.id = tenants.property_id
        AND properties.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete messages for their tenants"
  ON public.messages FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM tenants
    WHERE tenants.id = messages.tenant_id
    AND EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = tenants.property_id
      AND properties.user_id = auth.uid()
    )
  ));

CREATE POLICY "Tenants can view their own messages"
  ON public.messages FOR SELECT TO authenticated
  USING (tenant_id IN (
    SELECT get_current_tenant_info.tenant_id
    FROM get_current_tenant_info()
  ));

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
