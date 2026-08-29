CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', '')
  );
  RETURN new;
END;
$$;


--
-- Name: update_profiles_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_profiles_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_properties_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_properties_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: maintenance_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    property_id uuid NOT NULL,
    unit_id uuid,
    title text NOT NULL,
    description text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    due_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    vendor_id uuid,
    assigned_at timestamp with time zone
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    amount numeric NOT NULL,
    payment_date date NOT NULL,
    payment_method text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    first_name text,
    last_name text,
    phone text,
    role text DEFAULT 'Property Manager'::text,
    timezone text DEFAULT 'Eastern Standard Time'::text,
    avatar_url text,
    email_notifications boolean DEFAULT true,
    sms_notifications boolean DEFAULT false,
    push_notifications boolean DEFAULT true,
    marketing_communications boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    theme text DEFAULT 'light'::text
);


--
-- Name: properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.properties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    address text NOT NULL,
    city text NOT NULL,
    province text NOT NULL,
    postal_code text,
    property_type text NOT NULL,
    units integer DEFAULT 1 NOT NULL,
    timezone text NOT NULL,
    purchase_price numeric(15,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    purchase_date date,
    current_value numeric
);


--
-- Name: tenant_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    document_title text NOT NULL,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_size integer NOT NULL,
    file_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    property_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    lease_start date NOT NULL,
    lease_end date NOT NULL,
    monthly_rent numeric NOT NULL,
    security_deposit numeric,
    balance numeric DEFAULT 0,
    relationship_score integer DEFAULT 50,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    emergency_contact_name text,
    emergency_contact_phone text,
    emergency_contact_relationship text
);


--
-- Name: units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_id uuid NOT NULL,
    unit_number text NOT NULL,
    description text,
    size_sqft numeric,
    required_rent numeric,
    required_deposit numeric,
    current_tenant text,
    current_lease_start date,
    current_lease_end date,
    incoming_tenant text,
    incoming_lease_start date,
    incoming_lease_end date,
    status text DEFAULT 'vacant'::text NOT NULL,
    status_until date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.units REPLICA IDENTITY FULL;


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    company_name text,
    service_type text NOT NULL,
    contact_phone text NOT NULL,
    contact_email text,
    address text,
    city text,
    province text,
    postal_code text,
    rating numeric(2,1) DEFAULT 0,
    jobs_completed integer DEFAULT 0,
    is_preferred boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: maintenance_requests maintenance_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: properties properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_pkey PRIMARY KEY (id);


--
-- Name: tenant_documents tenant_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_documents
    ADD CONSTRAINT tenant_documents_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_unit_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_unit_id_key UNIQUE (unit_id);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: idx_properties_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_properties_created_at ON public.properties USING btree (created_at DESC);


--
-- Name: idx_properties_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_properties_user_id ON public.properties USING btree (user_id);


--
-- Name: maintenance_requests update_maintenance_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_maintenance_requests_updated_at BEFORE UPDATE ON public.maintenance_requests FOR EACH ROW EXECUTE FUNCTION public.update_properties_updated_at();


--
-- Name: payments update_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_properties_updated_at();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_profiles_updated_at();


--
-- Name: properties update_properties_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_properties_updated_at();


--
-- Name: tenant_documents update_tenant_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tenant_documents_updated_at BEFORE UPDATE ON public.tenant_documents FOR EACH ROW EXECUTE FUNCTION public.update_properties_updated_at();


--
-- Name: tenants update_tenants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_properties_updated_at();


--
-- Name: units update_units_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.update_properties_updated_at();


--
-- Name: vendors update_vendors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_properties_updated_at();


--
-- Name: maintenance_requests maintenance_requests_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: maintenance_requests maintenance_requests_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;


--
-- Name: maintenance_requests maintenance_requests_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: properties properties_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tenant_documents tenant_documents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_documents
    ADD CONSTRAINT tenant_documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenants tenants_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: tenants tenants_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE;


--
-- Name: units units_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: tenant_documents Users can create documents for their tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create documents for their tenants" ON public.tenant_documents FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.tenants
  WHERE ((tenants.id = tenant_documents.tenant_id) AND (EXISTS ( SELECT 1
           FROM public.properties
          WHERE ((properties.id = tenants.property_id) AND (properties.user_id = auth.uid())))))))));


--
-- Name: payments Users can create payments for their tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create payments for their tenants" ON public.payments FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.tenants
  WHERE ((tenants.id = payments.tenant_id) AND (EXISTS ( SELECT 1
           FROM public.properties
          WHERE ((properties.id = tenants.property_id) AND (properties.user_id = auth.uid())))))))));


--
-- Name: tenants Users can create tenants for their own properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create tenants for their own properties" ON public.tenants FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.properties
  WHERE ((properties.id = tenants.property_id) AND (properties.user_id = auth.uid())))));


--
-- Name: maintenance_requests Users can create their own maintenance requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own maintenance requests" ON public.maintenance_requests FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: properties Users can create their own properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own properties" ON public.properties FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: vendors Users can create their own vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own vendors" ON public.vendors FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: units Users can create units for their own properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create units for their own properties" ON public.units FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.properties
  WHERE ((properties.id = units.property_id) AND (properties.user_id = auth.uid())))));


--
-- Name: tenant_documents Users can delete documents for their tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete documents for their tenants" ON public.tenant_documents FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.tenants
  WHERE ((tenants.id = tenant_documents.tenant_id) AND (EXISTS ( SELECT 1
           FROM public.properties
          WHERE ((properties.id = tenants.property_id) AND (properties.user_id = auth.uid()))))))));


--
-- Name: payments Users can delete payments for their tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete payments for their tenants" ON public.payments FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.tenants
  WHERE ((tenants.id = payments.tenant_id) AND (EXISTS ( SELECT 1
           FROM public.properties
          WHERE ((properties.id = tenants.property_id) AND (properties.user_id = auth.uid()))))))));


--
-- Name: maintenance_requests Users can delete their own maintenance requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own maintenance requests" ON public.maintenance_requests FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can delete their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own profile" ON public.profiles FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: properties Users can delete their own properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own properties" ON public.properties FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: tenants Users can delete their own property tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own property tenants" ON public.tenants FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.properties
  WHERE ((properties.id = tenants.property_id) AND (properties.user_id = auth.uid())))));


--
-- Name: units Users can delete their own property units; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own property units" ON public.units FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.properties
  WHERE ((properties.id = units.property_id) AND (properties.user_id = auth.uid())))));


--
-- Name: vendors Users can delete their own vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own vendors" ON public.vendors FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: payments Users can update payments for their tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update payments for their tenants" ON public.payments FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.tenants
  WHERE ((tenants.id = payments.tenant_id) AND (EXISTS ( SELECT 1
           FROM public.properties
          WHERE ((properties.id = tenants.property_id) AND (properties.user_id = auth.uid()))))))));


--
-- Name: maintenance_requests Users can update their own maintenance requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own maintenance requests" ON public.maintenance_requests FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: properties Users can update their own properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own properties" ON public.properties FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: tenants Users can update their own property tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own property tenants" ON public.tenants FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.properties
  WHERE ((properties.id = tenants.property_id) AND (properties.user_id = auth.uid())))));


--
-- Name: units Users can update their own property units; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own property units" ON public.units FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.properties
  WHERE ((properties.id = units.property_id) AND (properties.user_id = auth.uid())))));


--
-- Name: vendors Users can update their own vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own vendors" ON public.vendors FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: tenant_documents Users can view documents for their tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view documents for their tenants" ON public.tenant_documents FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tenants
  WHERE ((tenants.id = tenant_documents.tenant_id) AND (EXISTS ( SELECT 1
           FROM public.properties
          WHERE ((properties.id = tenants.property_id) AND (properties.user_id = auth.uid()))))))));


--
-- Name: payments Users can view payments for their tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view payments for their tenants" ON public.payments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tenants
  WHERE ((tenants.id = payments.tenant_id) AND (EXISTS ( SELECT 1
           FROM public.properties
          WHERE ((properties.id = tenants.property_id) AND (properties.user_id = auth.uid()))))))));


--
-- Name: maintenance_requests Users can view their own maintenance requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own maintenance requests" ON public.maintenance_requests FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: properties Users can view their own properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own properties" ON public.properties FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: tenants Users can view their own property tenants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own property tenants" ON public.tenants FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.properties
  WHERE ((properties.id = tenants.property_id) AND (properties.user_id = auth.uid())))));


--
-- Name: units Users can view their own property units; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own property units" ON public.units FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.properties
  WHERE ((properties.id = units.property_id) AND (properties.user_id = auth.uid())))));


--
-- Name: vendors Users can view their own vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own vendors" ON public.vendors FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: maintenance_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: properties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: tenants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

--
-- Name: units; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

--
-- Name: vendors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


