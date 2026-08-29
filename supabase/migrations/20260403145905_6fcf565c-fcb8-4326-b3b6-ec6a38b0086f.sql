CREATE POLICY "Property managers can update maintenance requests for their properties"
ON public.maintenance_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM properties
    WHERE properties.id = maintenance_requests.property_id
    AND properties.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM properties
    WHERE properties.id = maintenance_requests.property_id
    AND properties.user_id = auth.uid()
  )
);

CREATE POLICY "Property managers can delete maintenance requests for their properties"
ON public.maintenance_requests
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM properties
    WHERE properties.id = maintenance_requests.property_id
    AND properties.user_id = auth.uid()
  )
);