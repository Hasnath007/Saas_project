-- Add down_payment column to properties table
ALTER TABLE public.properties 
ADD COLUMN down_payment numeric NULL;