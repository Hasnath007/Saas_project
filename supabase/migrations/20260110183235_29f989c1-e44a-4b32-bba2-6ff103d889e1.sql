-- Add RLS policy for tenants to read their own record by matching email
CREATE POLICY "Tenants can view their own record by email"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Add RLS policy for tenants to read their property by email match
CREATE POLICY "Tenants can view their property"
ON public.properties
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT property_id FROM public.tenants 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Add RLS policy for tenants to read their unit by email match
CREATE POLICY "Tenants can view their unit"
ON public.units
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT unit_id FROM public.tenants 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Add RLS policy for tenants to read their payments
CREATE POLICY "Tenants can view their own payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT id FROM public.tenants 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Add RLS policy for tenants to read their maintenance requests
CREATE POLICY "Tenants can view their unit maintenance requests"
ON public.maintenance_requests
FOR SELECT
TO authenticated
USING (
  unit_id IN (
    SELECT unit_id FROM public.tenants 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Add RLS policy for tenants to read their documents
CREATE POLICY "Tenants can view their own documents"
ON public.tenant_documents
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT id FROM public.tenants 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);