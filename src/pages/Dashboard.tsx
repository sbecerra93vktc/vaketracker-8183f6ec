import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import GoogleMapComponent from '@/components/GoogleMapComponent';
import LocationCapture from '@/components/LocationCapture';
import LocationHistory from '@/components/LocationHistory';
import ActivitySummary from '@/components/ActivitySummary';
import ActivityChart from '@/components/ActivityChart';
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
        <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <h1 className="text-xl sm:text-2xl font-bold text-warning">Vaketracker</h1>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <span className="text-xs sm:text-sm text-muted-foreground truncate">
              Welcome, {user?.email}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground">
              {userRole}
            </span>
            <div className="flex gap-2">
              {userRole === 'admin' && (
                <Button variant="outline" size="sm" onClick={() => navigate('/admin')} className="text-xs">
                  Admin Panel
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleSignOut} className="text-xs">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-3 sm:p-6">
        <div className="space-y-6 mb-6">
          <LocationCapture onLocationCaptured={refreshData} />
          <ActivitySummary />
          <LocationHistory />
        </div>

        <div className="space-y-8">
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

          {hasPermission('view_team_locations') && (
            <ActivityChart />
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;