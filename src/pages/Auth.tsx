import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [isFirstUser, setIsFirstUser] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get('token');

  // Check if this is the first user on component mount
  useEffect(() => {
    const checkFirstUser = async () => {
      try {
        // Simple approach: if someone is accessing /auth without being logged in,
        // and there's no token in URL, check if we can access any public data
        // If we can't, it likely means there are existing users with RLS blocking us
        
        // Try to access invitations table (which has public read policies)
        const { data: invitationsData, error: invitationsError } = await supabase
          .from('invitations')
          .select('id')
          .limit(1);
        
        console.log('Invitations check:', invitationsData, 'Error:', invitationsError);
        
        // If we can query invitations, it means there's a user system in place
        // Only consider it "first user" if we get a specific error or if explicitly no data exists
        const hasInvitationSystem = !invitationsError && Array.isArray(invitationsData);
        
        // Also check if there's a token in the URL (means someone is trying to register with invitation)
        const hasToken = token !== null;
        
        const firstUser = !hasInvitationSystem && !hasToken;
        
        console.log('Has invitation system:', hasInvitationSystem, 'Has token:', hasToken, 'First user:', firstUser);
        setIsFirstUser(firstUser);
      } catch (err) {
        console.error('Error checking first user:', err);
        // If we can't determine, default to false (not first user) to be safe
        setIsFirstUser(false);
      }
    };
    
    checkFirstUser();
  }, [token]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error signing in',
        description: error.message,
      });
    } else {
      navigate('/');
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const invitationToken = formData.get('token') as string || token;

    // If this is not the first user, validate invitation token
    if (!isFirstUser) {
      if (!invitationToken) {
        toast({
          variant: 'destructive',
          title: 'Invalid invitation',
          description: 'You need a valid invitation to register.',
        });
        setLoading(false);
        return;
      }

      // Verify invitation token
      const { data: invitation, error: invitationError } = await supabase
        .from('invitations')
        .select('*')
        .eq('token', invitationToken)
        .eq('used', false)
        .single();

      if (invitationError || !invitation || invitation.email !== email) {
        toast({
          variant: 'destructive',
          title: 'Invalid invitation',
          description: 'This invitation is invalid or has already been used.',
        });
        setLoading(false);
        return;
      }

      // Check if invitation is expired
      if (new Date(invitation.expires_at) < new Date()) {
        toast({
          variant: 'destructive',
          title: 'Invitation expired',
          description: 'This invitation has expired.',
        });
        setLoading(false);
        return;
      }
    }

    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error signing up',
        description: error.message,
      });
    } else {
      // Mark invitation as used (only if not first user)
      if (!isFirstUser && invitationToken) {
        await supabase
          .from('invitations')
          .update({ used: true })
          .eq('token', invitationToken);
      }

      toast({
        title: 'Account created!',
        description: isFirstUser 
          ? 'Welcome! You are now the administrator of this system.'
          : 'Please check your email to confirm your account.',
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sales Management System</CardTitle>
          <CardDescription>
            {isFirstUser 
              ? 'Create your administrator account to get started'
              : 'Sign in to your account or register with an invitation'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={token ? 'signup' : 'signin'} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">
                {isFirstUser ? 'Create Admin Account' : 'Register'}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    name="email"
                    type="email"
                    required
                    placeholder="Enter your email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    name="password"
                    type="password"
                    required
                    placeholder="Enter your password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                {!isFirstUser && (
                  <div className="space-y-2">
                    <Label htmlFor="signup-token">Invitation Token</Label>
                    <Input
                      id="signup-token"
                      name="token"
                      defaultValue={token || ''}
                      required={!isFirstUser}
                      placeholder="Enter invitation token"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    name="email"
                    type="email"
                    required
                    placeholder="Enter your email"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      required
                      placeholder="First name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      required
                      placeholder="Last name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    name="password"
                    type="password"
                    required
                    placeholder="Create a password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading 
                    ? 'Creating account...' 
                    : isFirstUser 
                      ? 'Create Admin Account' 
                      : 'Create Account'
                  }
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;