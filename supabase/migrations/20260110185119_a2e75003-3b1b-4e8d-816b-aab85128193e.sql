-- Allow tenants to insert their own documents
CREATE POLICY "Tenants can upload their own documents"
ON public.tenant_documents
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IN (SELECT tenant_id FROM public.get_current_tenant_info())
);

-- Create storage policy for tenant-documents bucket to allow tenant uploads
CREATE POLICY "Tenants can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tenant-documents' AND
  (storage.foldername(name))[1] IN (SELECT tenant_id::text FROM public.get_current_tenant_info())
);

-- Tenants can view their own uploaded files
CREATE POLICY "Tenants can view their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'tenant-documents' AND
  (storage.foldername(name))[1] IN (SELECT tenant_id::text FROM public.get_current_tenant_info())
);