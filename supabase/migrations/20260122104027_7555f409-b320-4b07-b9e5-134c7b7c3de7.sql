-- Add unit_id column to property_income table
ALTER TABLE public.property_income
ADD COLUMN unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL;

-- Add unit_id column to property_expenses table
ALTER TABLE public.property_expenses
ADD COLUMN unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL;