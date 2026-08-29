CREATE POLICY "Tenants can create messages for their record"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IN (
    SELECT get_current_tenant_info.tenant_id
    FROM get_current_tenant_info() get_current_tenant_info(tenant_id, property_id, unit_id)
  )
);