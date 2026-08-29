-- Make unit_id nullable in tenants table for single-family properties
ALTER TABLE public.tenants 
ALTER COLUMN unit_id DROP NOT NULL;