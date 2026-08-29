CREATE POLICY "Property managers can view maintenance requests for their properties"
ON public.maintenance_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM properties
    WHERE properties.id = maintenance_requests.property_id
    AND properties.user_id = auth.uid()
  )
);