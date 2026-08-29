-- Allow tenants to create maintenance requests for their own unit
CREATE POLICY "Tenants can create maintenance requests for their unit"
ON public.maintenance_requests
FOR INSERT
TO authenticated
WITH CHECK (
  unit_id IN (SELECT unit_id FROM public.get_current_tenant_info()) AND
  property_id IN (SELECT property_id FROM public.get_current_tenant_info())
);