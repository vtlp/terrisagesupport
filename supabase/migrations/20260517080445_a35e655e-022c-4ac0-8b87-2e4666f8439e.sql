ALTER TABLE public.terrisage_amenity_master DROP CONSTRAINT terrisage_amenity_master_pkey;
ALTER TABLE public.terrisage_amenity_master ADD PRIMARY KEY (amenity_id, property_type);