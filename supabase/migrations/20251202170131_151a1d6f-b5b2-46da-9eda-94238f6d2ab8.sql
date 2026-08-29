-- Create storage bucket for profile pictures
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for tenant documents  
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-documents', 'tenant-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for profile-pictures bucket (public read, auth write)
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-pictures');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS policies for tenant-documents bucket (private, auth access)
CREATE POLICY "Users can view their own tenant documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'tenant-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own tenant documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tenant-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own tenant documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'tenant-documents' AND auth.uid()::text = (storage.foldername(name))[1]);