import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Upload, User } from 'lucide-react';

interface ProfileData {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  territory: string | null;
  phone: string | null;
  country: string | null;
  avatar_url: string | null;
}

const Profile = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Error loading profile',
          description: error.message,
        });
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !profile) return;

    setUploading(true);

    try {
      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}.${fileExt}`;

      // First, check if we need to create the avatars bucket
      const { data: buckets } = await supabase.storage.listBuckets();
      const avatarBucket = buckets?.find(bucket => bucket.name === 'avatars');
      
      if (!avatarBucket) {
        // Create the avatars bucket if it doesn't exist
        const { error: bucketError } = await supabase.storage.createBucket('avatars', {
          public: true,
        });
        
        if (bucketError) {
          throw new Error(`Failed to create avatars bucket: ${bucketError.message}`);
        }
      }

      // Upload the file
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update the profile with the new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('user_id', user.id);

      if (updateError) {
        throw updateError;
      }

      // Update local state
      setProfile(prev => prev ? { ...prev, avatar_url: urlData.publicUrl } : null);

      toast({
        title: 'Avatar updated',
        description: 'Your profile photo has been updated successfully.',
      });

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error uploading avatar',
        description: error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !profile) return;

    setSaving(true);

    try {
      const formData = new FormData(e.currentTarget);
      const updateData = {
        first_name: formData.get('firstName') as string,
        last_name: formData.get('lastName') as string,
        company: formData.get('company') as string,
        territory: formData.get('territory') as string,
        phone: formData.get('phone') as string,
        country: formData.get('country') as string,
      };

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      // Update local state
      setProfile(prev => prev ? { ...prev, ...updateData } : null);

      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      });

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error updating profile',
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Profile not found. Please contact support.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Mi Perfil</h1>
          <p className="text-muted-foreground">Gestiona tu información personal</p>
        </div>

        {/* Avatar Section */}
        <Card>
          <CardHeader>
            <CardTitle>Foto de Perfil</CardTitle>
            <CardDescription>
              Sube una foto para personalizar tu perfil
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-lg">
                  {profile.first_name?.[0]?.toUpperCase() || ''}
                  {profile.last_name?.[0]?.toUpperCase() || ''}
                  {(!profile.first_name && !profile.last_name) && <User className="h-8 w-8" />}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Label htmlFor="avatar" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 border border-input rounded-md hover:bg-accent hover:text-accent-foreground">
                    <Upload className="h-4 w-4" />
                    {uploading ? 'Subiendo...' : 'Cambiar Foto'}
                  </div>
                </Label>
                <Input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  JPG, PNG o GIF. Máximo 5MB.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle>Información Personal</CardTitle>
            <CardDescription>
              Actualiza tu información personal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Nombre</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    defaultValue={profile.first_name || ''}
                    placeholder="Nombre"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Apellido</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    defaultValue={profile.last_name || ''}
                    placeholder="Apellido"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={profile.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  El email no se puede cambiar
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Empresa</Label>
                <Input
                  id="company"
                  name="company"
                  defaultValue={profile.company || ''}
                  placeholder="Nombre de la empresa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="territory">Territorio</Label>
                <Input
                  id="territory"
                  name="territory"
                  defaultValue={profile.territory || ''}
                  placeholder="Tu territorio de ventas"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={profile.phone || ''}
                  placeholder="Número de teléfono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">País</Label>
                <select
                  id="country"
                  name="country"
                  defaultValue={profile.country || ''}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Selecciona tu país</option>
                  <option value="Mexico">México</option>
                  <option value="Guatemala">Guatemala</option>
                  <option value="El Salvador">El Salvador</option>
                  <option value="Honduras">Honduras</option>
                  <option value="Nicaragua">Nicaragua</option>
                  <option value="Costa Rica">Costa Rica</option>
                </select>
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;