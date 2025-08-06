import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import GoogleMapComponent from '@/components/GoogleMapComponent';
import LocationCapture from '@/components/LocationCapture';
import LocationHistory from '@/components/LocationHistory';
import ActivitySummary from '@/components/ActivitySummary';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { user, userRole, signOut } = useAuth();
  const { hasPermission } = usePermissions(user, userRole);
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
          <h1 className="text-2xl font-bold text-warning">Vaketracker</h1>
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
        <div className="space-y-6 mb-6">
          <ActivitySummary />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LocationCapture onLocationCaptured={refreshData} />
            <LocationHistory />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {hasPermission('view_team_locations') ? 'Mapa del Territorio del Equipo' : 'Mapa de Mi Territorio'}
            </CardTitle>
            <CardDescription>
              {hasPermission('view_team_locations') 
                ? 'Visualiza el territorio de ventas y ubicaciones de clientes del equipo'
                : 'Visualiza tu territorio de ventas y ubicaciones de clientes'
              }
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