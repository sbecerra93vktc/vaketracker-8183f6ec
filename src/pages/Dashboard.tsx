import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import GoogleMapComponent from '@/components/GoogleMapComponent';
import LocationCapture from '@/components/LocationCapture';
import LocationHistory from '@/components/LocationHistory';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { user, userRole, signOut } = useAuth();
  const navigate = useNavigate();

  const refreshData = () => {
    // This function can be called to refresh location data
    window.location.reload();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Sales Management Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {user?.email}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground">
              {userRole}
            </span>
            {userRole === 'admin' && (
              <Button variant="outline" onClick={() => navigate('/admin')}>
                Admin Panel
              </Button>
            )}
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Today's Tasks</CardTitle>
              <CardDescription>Your scheduled activities</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">5</p>
              <p className="text-xs text-muted-foreground">
                +2 from yesterday
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Leads</CardTitle>
              <CardDescription>Prospects in your pipeline</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">12</p>
              <p className="text-xs text-muted-foreground">
                +3 this week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Sales</CardTitle>
              <CardDescription>Revenue generated this month</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">$24,500</p>
              <p className="text-xs text-muted-foreground">
                +15% from last month
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <LocationCapture onLocationCaptured={refreshData} />
          <LocationHistory />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Territory Map</CardTitle>
            <CardDescription>
              Visualize your sales territory and customer locations
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <GoogleMapComponent />
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;