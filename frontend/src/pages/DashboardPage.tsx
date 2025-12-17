import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { utilApi, testApi, UserInfo } from '@/api/util';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { User, Shield, Mail, RefreshCw, Loader2, CheckCircle, XCircle, Activity } from 'lucide-react';
import { AxiosError } from 'axios';

const DashboardPage = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  
  const [profileData, setProfileData] = useState<UserInfo | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  
  const [protectedMessage, setProtectedMessage] = useState<string | null>(null);
  const [protectedLoading, setProtectedLoading] = useState(false);
  const [protectedError, setProtectedError] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (!user?.username) return;
    
    setProfileLoading(true);
    setProfileError(null);
    try {
      const data = await utilApi.getUserInfo(user.username);
      setProfileData(data);
      toast({
        title: 'Profile Fetched',
        description: 'Your profile data has been loaded successfully.',
      });
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      const message = axiosError.response?.data?.message || 'Failed to fetch profile data';
      setProfileError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setProfileLoading(false);
    }
  };

  const testProtectedApi = async () => {
    setProtectedLoading(true);
    setProtectedError(null);
    try {
      const message = await testApi.getProtectedMessage();
      setProtectedMessage(message);
      toast({
        title: 'API Test Successful',
        description: 'Protected endpoint responded successfully.',
      });
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      const message = axiosError.response?.data?.message || 'Failed to access protected endpoint';
      setProtectedError(message);
      toast({
        title: 'API Test Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setProtectedLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Welcome Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Welcome back, {user?.username}!
        </h1>
        <p className="text-muted-foreground">
          Here's an overview of your AgriVerse dashboard.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* User Summary Card */}
        <Card className="border-border/50 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              User Summary
            </CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">{user?.username}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              {isAdmin ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  <Shield className="h-3 w-3" />
                  Admin
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                  <User className="h-3 w-3" />
                  User
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Fetch Profile Card */}
        <Card className="border-border/50 animate-fade-in" style={{ animationDelay: '200ms' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Fetch My Profile
            </CardTitle>
            <CardDescription>Load your profile from the API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={fetchProfile} disabled={profileLoading} className="w-full">
              {profileLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Fetch Profile
                </>
              )}
            </Button>

            {profileLoading && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            )}

            {profileError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <XCircle className="h-4 w-4" />
                {profileError}
              </div>
            )}

            {profileData && !profileLoading && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground font-medium">{profileData.username}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{profileData.email}</span>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {profileData.roles?.map((role) => (
                    <span
                      key={role}
                      className="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test Protected API Card */}
        <Card className="border-border/50 animate-fade-in" style={{ animationDelay: '300ms' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Test Protected API
            </CardTitle>
            <CardDescription>Test the /api/test/user endpoint</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={testProtectedApi} disabled={protectedLoading} variant="outline" className="w-full">
              {protectedLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Activity className="mr-2 h-4 w-4" />
                  Test Endpoint
                </>
              )}
            </Button>

            {protectedLoading && (
              <Skeleton className="h-16 w-full" />
            )}

            {protectedError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <XCircle className="h-4 w-4" />
                {protectedError}
              </div>
            )}

            {protectedMessage && !protectedLoading && (
              <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                <div className="flex items-center gap-2 text-success text-sm mb-1">
                  <CheckCircle className="h-4 w-4" />
                  Success
                </div>
                <p className="text-sm text-foreground">{protectedMessage}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
