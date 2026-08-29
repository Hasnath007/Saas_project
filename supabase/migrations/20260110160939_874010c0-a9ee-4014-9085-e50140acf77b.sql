-- Create table for property income entries
CREATE TABLE public.property_income (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for property expense entries
CREATE TABLE public.property_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.property_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_expenses ENABLE ROW LEVEL SECURITY;

-- RLS policies for property_income
CREATE POLICY "Users can view income for their properties"
ON public.property_income FOR SELECT
USING (EXISTS (
  SELECT 1 FROM properties 
  WHERE properties.id = property_income.property_id 
  AND properties.user_id = auth.uid()
));

CREATE POLICY "Users can create income for their properties"
ON public.property_income FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM properties 
    WHERE properties.id = property_income.property_id 
    AND properties.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update income for their properties"
ON public.property_income FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM properties 
  WHERE properties.id = property_income.property_id 
  AND properties.user_id = auth.uid()
));

CREATE POLICY "Users can delete income for their properties"
ON public.property_income FOR DELETE
USING (EXISTS (
  SELECT 1 FROM properties 
  WHERE properties.id = property_income.property_id 
  AND properties.user_id = auth.uid()
));

-- RLS policies for property_expenses
CREATE POLICY "Users can view expenses for their properties"
ON public.property_expenses FOR SELECT
USING (EXISTS (
  SELECT 1 FROM properties 
  WHERE properties.id = property_expenses.property_id 
  AND properties.user_id = auth.uid()
));

CREATE POLICY "Users can create expenses for their properties"
ON public.property_expenses FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM properties 
    WHERE properties.id = property_expenses.property_id 
    AND properties.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update expenses for their properties"
ON public.property_expenses FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM properties 
  WHERE properties.id = property_expenses.property_id 
  AND properties.user_id = auth.uid()
));

CREATE POLICY "Users can delete expenses for their properties"
ON public.property_expenses FOR DELETE
USING (EXISTS (
  SELECT 1 FROM properties 
  WHERE properties.id = property_expenses.property_id 
  AND properties.user_id = auth.uid()
));