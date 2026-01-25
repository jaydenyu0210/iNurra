-- Update the handle_new_user function to set a default display_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, phone, display_name)
  VALUES (NEW.id, NEW.phone, 'Friend');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
