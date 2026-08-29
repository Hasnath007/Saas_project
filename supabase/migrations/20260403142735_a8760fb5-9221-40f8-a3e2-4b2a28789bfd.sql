CREATE OR REPLACE FUNCTION public.get_current_tenant_info()
RETURNS TABLE(tenant_id uuid, property_id uuid, unit_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT t.id, t.property_id, t.unit_id
  FROM public.tenants t
  WHERE t.email = public.get_current_user_email()
  ORDER BY
    CASE WHEN t.status = 'active' THEN 0 ELSE 1 END,
    t.updated_at DESC,
    t.created_at DESC,
    t.id DESC
  LIMIT 1
$function$;