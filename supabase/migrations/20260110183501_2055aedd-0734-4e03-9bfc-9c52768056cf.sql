-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Tenants can view their property" ON public.properties;
DROP POLICY IF EXISTS "Tenants can view their unit" ON public.units;
DROP POLICY IF EXISTS "Tenants can view their own record by email" ON public.tenants;
DROP POLICY IF EXISTS "Tenants can view their own payments" ON public.payments;
DROP POLICY IF EXISTS "Tenants can view their unit maintenance requests" ON public.maintenance_requests;
DROP POLICY IF EXISTS "Tenants can view their own documents" ON public.tenant_documents;

-- Create a helper function to get the current user's email safely
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid()
$$;

-- Create a helper function to get tenant info for current user
CREATE OR REPLACE FUNCTION public.get_current_tenant_info()
RETURNS TABLE(tenant_id uuid, property_id uuid, unit_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, property_id, unit_id 
  FROM public.tenants 
  WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  LIMIT 1
$$;

-- Now create non-recursive RLS policies

-- Tenants can view their own tenant record
CREATE POLICY "Tenants can view their own record by email"
ON public.tenants
FOR SELECT
TO authenticated
USING (email = public.get_current_user_email());

-- Tenants can view their property (using security definer function)
CREATE POLICY "Tenants can view their property"
ON public.properties
FOR SELECT
TO authenticated
USING (
  id IN (SELECT property_id FROM public.get_current_tenant_info())
);

-- Tenants can view their unit (using security definer function)
CREATE POLICY "Tenants can view their unit"
ON public.units
FOR SELECT
TO authenticated
USING (
  id IN (SELECT unit_id FROM public.get_current_tenant_info())
);

-- Tenants can view their payments
CREATE POLICY "Tenants can view their own payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  tenant_id IN (SELECT tenant_id FROM public.get_current_tenant_info())
);

-- Tenants can view their maintenance requests
CREATE POLICY "Tenants can view their unit maintenance requests"
ON public.maintenance_requests
FOR SELECT
TO authenticated
USING (
  unit_id IN (SELECT unit_id FROM public.get_current_tenant_info())
);

-- Tenants can view their documents
CREATE POLICY "Tenants can view their own documents"
ON public.tenant_documents
FOR SELECT
TO authenticated
USING (
  tenant_id IN (SELECT tenant_id FROM public.get_current_tenant_info())
);