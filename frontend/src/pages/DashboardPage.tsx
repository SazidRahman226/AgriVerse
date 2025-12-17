import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Shield, MessageSquare, Settings } from "lucide-react";

const DashboardPage = () => {
  const { user, isAdmin } = useAuth();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Welcome back, {user?.username}!
        </h1>
        <p className="text-muted-foreground">
          Manage your account and access AgriVerse features from here.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* User Summary */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Account
            </CardTitle>
            <CardDescription>Your basic account information</CardDescription>
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

            <div className="pt-1">
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

        {/* Quick Actions */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Quick Actions
            </CardTitle>
            <CardDescription>Jump to common pages</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <Button asChild className="w-full">
              <Link to="/forum">
                <MessageSquare className="mr-2 h-4 w-4" />
                Go to Forum
              </Link>
            </Button>

            <Button asChild variant="outline" className="w-full">
              <Link to="/profile">
                <User className="mr-2 h-4 w-4" />
                View Profile
              </Link>
            </Button>

            {isAdmin && (
              <Button asChild variant="secondary" className="w-full">
                <Link to="/admin">
                  <Shield className="mr-2 h-4 w-4" />
                  Admin Panel
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Optional: Space for future widgets */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>More dashboard widgets can be added later</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            You can add stats here (total posts, latest activity, crop alerts, etc.).
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
