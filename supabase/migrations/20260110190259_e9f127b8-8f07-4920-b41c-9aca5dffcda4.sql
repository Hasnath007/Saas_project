-- Allow tenants to record their own payments
CREATE POLICY "Tenants can record their own payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IN (SELECT tenant_id FROM public.get_current_tenant_info())
);