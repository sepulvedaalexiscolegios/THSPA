-- SQL Setup for TH Comercial
-- Copy and paste this into the Supabase SQL Editor

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    rut TEXT UNIQUE NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    coordinates JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Products Table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    category TEXT DEFAULT 'General',
    subcategory TEXT,
    price DOUBLE PRECISION DEFAULT 0,
    cost_price DOUBLE PRECISION DEFAULT 0,
    stock DOUBLE PRECISION DEFAULT 0,
    min_stock DOUBLE PRECISION DEFAULT 0,
    unit TEXT DEFAULT 'Unidad',
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Quotations Table
CREATE TABLE IF NOT EXISTS public.quotations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    date TIMESTAMPTZ DEFAULT now(),
    items JSONB NOT NULL,
    total DOUBLE PRECISION DEFAULT 0,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Sales Table
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    date TIMESTAMPTZ DEFAULT now(),
    items JSONB NOT NULL,
    total DOUBLE PRECISION DEFAULT 0,
    status TEXT DEFAULT 'paid',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Subcategories Table
CREATE TABLE IF NOT EXISTS public.subcategories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(category_id, name)
);

-- NOTE: If you get "category_id not found in schema cache", please run this:
-- NOTIFY pgrst, 'reload schema';
-- Or simply restart your Supabase project or wait a few minutes.

-- 8. Enable Realtime
-- Go to Database -> Replication in Supabase to enable for these tables
-- Or run:
-- alter publication supabase_realtime add table products;
-- alter publication supabase_realtime add table customers;
-- alter publication supabase_realtime add table quotations;
-- alter publication supabase_realtime add table sales;
-- alter publication supabase_realtime add table categories;
-- alter publication supabase_realtime add table subcategories;
