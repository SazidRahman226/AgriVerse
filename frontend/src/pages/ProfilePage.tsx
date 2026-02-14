import { useEffect, useState } from "react";
import BackButton from "@/components/BackButton";
import { utilApi } from "@/api/util";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Mail, Shield, BadgeCheck, Hash } from "lucide-react";

type UserProfile = {
  id: number;
  username: string;
  email: string;
  roles: string[];
  identificationNumber?: string | null;
};

const ProfilePage = () => {
  const { user, isGovtOfficer } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.username) return;
    (async () => {
      try {
        const res = await utilApi.getUserInfo(user.username);
        setProfile(res);
      } catch {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.username]);

  const isGovt = isGovtOfficer;
  const idNo = profile?.identificationNumber;

  return (
    <div className="min-h-[calc(100vh-8rem)] py-12 px-4">
      <div className="container mx-auto max-w-2xl space-y-6">
        <BackButton className="-ml-2 mb-2" />
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">Your account information</p>

        {error && <div className="text-sm text-destructive">{error}</div>}

        <Card className="border-border/50 animate-fade-in" style={{ animationDelay: "100ms" }}>
          <CardHeader>
            <div className="flex items-center gap-4">
              {loading ? (
                <Skeleton className="h-16 w-16 rounded-full" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-8 w-8 text-primary" />
                </div>
              )}
              <div>
                {loading ? (
                  <>
                    <Skeleton className="h-6 w-40 mb-2" />
                    <Skeleton className="h-4 w-28" />
                  </>
                ) : (
                  <>
                    <CardTitle className="text-xl">{profile?.username}</CardTitle>
                    <CardDescription>{profile?.email}</CardDescription>
                  </>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Email */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                {loading ? <Skeleton className="h-4 w-48" /> : <p className="font-medium text-foreground">{profile?.email}</p>}
              </div>
            </div>

            {/* Username */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Username</p>
                {loading ? <Skeleton className="h-4 w-36" /> : <p className="font-medium text-foreground">{profile?.username}</p>}
              </div>
            </div>

            {/* Roles */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Roles</p>
                {loading ? (
                  <Skeleton className="h-4 w-24" />
                ) : (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {profile?.roles?.map((r) => (
                      <span key={r} className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* User ID */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Hash className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">User ID</p>
                {loading ? <Skeleton className="h-4 w-16" /> : <p className="font-medium text-foreground">{profile?.id}</p>}
              </div>
            </div>

            {/* Identification Number (govt officer only) */}
            {isGovt && (
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BadgeCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Identification Number</p>
                  {loading ? <Skeleton className="h-4 w-32" /> : <p className="font-medium text-foreground">{idNo || "Not set"}</p>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;
