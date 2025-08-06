import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Vaketracker</CardTitle>
          <CardDescription>
            Manage your sales territory and customer relationships
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={() => navigate('/auth')} 
            className="w-full"
            size="lg"
          >
            Get Started
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Sign in to access your dashboard or register with an invitation
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
