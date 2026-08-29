-- Add occupancy_status column to properties table
ALTER TABLE properties 
ADD COLUMN occupancy_status text DEFAULT 'owner-occupied';

-- Add a check constraint for valid occupancy status values
ALTER TABLE properties
ADD CONSTRAINT valid_occupancy_status 
CHECK (occupancy_status IN ('owner-occupied', 'absentee', 'tenant-occupied', 'vacant'));