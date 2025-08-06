-- Enable realtime for locations table
ALTER TABLE public.locations REPLICA IDENTITY FULL;

-- Add the table to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;