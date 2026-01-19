import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { Bell, Video, Settings } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { signOut } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Menu, X, Heart, User, LogOut, Calendar } from "lucide-react";
import { toast } from "sonner";

export function Header() {
  const { user, role, isAuthenticated, logout } = useAuthContext();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [recentNotifs, setRecentNotifs] = useState<any[]>([]);
  const [videoAppointments, setVideoAppointments] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    async function fetchUnread() {
      try {
        const { data } = await api.get('/notifications/unread-count');
        setUnreadCount(data.count || 0);
        const { data: notifs } = await api.get('/notifications');
        setRecentNotifs(notifs.slice(0,5));

        // Fetch video-enabled appointments for patients
        if (role === 'patient') {
          const { data: appointments } = await api.get('/appointments');
          const videoEnabled = appointments.filter((appt: any) => appt.video?.enabled);
          setVideoAppointments(videoEnabled);
        }
      } catch (err) {
        // ignore
      }
    }

    fetchUnread();
  }, [isAuthenticated, role]);
  const handleSignOut = async () => {
    try {
      await logout();
      toast.success("Signed out successfully");
      navigate("/");
    } catch (error) {
      toast.error("Failed to sign out");
    }
  };

  const getInitials = () => {
    if (!user?.email) return "U";
    return user.email.charAt(0).toUpperCase();
  };

  const getDashboardLink = () => {
    switch (role) {
      case "admin":
        return "/admin";
      case "doctor":
        return "/doctor";
      case "patient":
        return "/dashboard";
      default:
        return "/dashboard";
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Heart className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-heading text-xl font-bold">MediConnect</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            to="/doctors"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Find Doctors
          </Link>
          <Link
            to="/specializations"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Specializations
          </Link>
          <Link
            to="/about"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            About
          </Link>
        </nav>

        {/* Desktop Auth + Notifications */}
        <div className="hidden md:flex items-center gap-4">
          {isAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Bell className="h-5 w-5" />
                  {/* Unread badge */}
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-white text-xs">{unreadCount}</span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-80" align="end" forceMount>
                <div className="p-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">Notifications</p>
                    <Button size="sm" variant="ghost" asChild>
                      <Link to="/notifications">View all</Link>
                    </Button>
                  </div>

                  {/* Video Call Section for Patients */}
                  {role === 'patient' && videoAppointments.length > 0 && (
                    <div className="mb-3 p-2 bg-blue-50 rounded border">
                      <p className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-1">
                        <Video className="h-4 w-4" />
                        Active Video Calls
                      </p>
                      <div className="space-y-1">
                        {videoAppointments.slice(0, 2).map((appt) => (
                          <Button
                            key={appt._id}
                            size="sm"
                            className="w-full justify-start text-xs"
                            onClick={() => {
                              window.open(appt.video.patientJoinUrl, '_blank', 'noopener,noreferrer');
                            }}
                          >
                            <Video className="h-3 w-3 mr-1" />
                            Join call with {appt.doctor?.profile?.full_name || 'Doctor'}
                          </Button>
                        ))}
                        {videoAppointments.length > 2 && (
                          <p className="text-xs text-blue-700 mt-1">
                            +{videoAppointments.length - 2} more calls available
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notification Settings */}
                  <div className="mb-3 p-2 border rounded">
                    <p className="text-sm font-medium mb-2">Notification Settings</p>
                    <div className="space-y-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full justify-start text-xs"
                        asChild
                      >
                        <Link to="/settings">
                          <Settings className="h-3 w-3 mr-1" />
                          Manage Preferences
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="w-full justify-start text-xs"
                        onClick={async () => {
                          try {
                            await api.delete('/notifications/clear-all');
                            setRecentNotifs([]);
                            setUnreadCount(0);
                          } catch (e) { console.error(e); }
                        }}
                      >
                        Clear All
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {recentNotifs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No recent notifications</p>
                    ) : (
                      recentNotifs.map((n) => (
                        <div key={n._id} className="p-2 border rounded hover:bg-muted/70 cursor-pointer" onClick={async () => {
                          try {
                            await api.put(`/notifications/${n._id}/read`);
                            setRecentNotifs((prev) => prev.map((x) => x._id === n._id ? { ...x, read: true } : x));
                            setUnreadCount((c) => Math.max(0, c - 1));
                            window.location.href = '/notifications';
                          } catch (e) { console.error(e); }
                        }}>
                          <div className="text-sm">{n.message}</div>
                          <div className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">{user?.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">{role}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={getDashboardLink()} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                {role !== 'admin' && (
                  <DropdownMenuItem asChild>
                    <Link to="/appointments" className="cursor-pointer">
                      <Calendar className="mr-2 h-4 w-4" />
                      Appointments
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button asChild>
                <Link to="/auth?mode=signup">Get Started</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile Menu Button with Notification Icon */}
        <div className="md:hidden flex items-center gap-2">
          {/* Notification Icon for Mobile */}
          {isAuthenticated && (
            <Button 
              variant="ghost" 
              size="icon"
              className="relative h-10 w-10 rounded-full"
              asChild
            >
              <Link to="/notifications">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-white text-xs font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            </Button>
          )}
          
          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border">
          <nav className="container py-4 flex flex-col gap-4">
            <Link
              to="/doctors"
              className="text-sm font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Find Doctors
            </Link>
            <Link
              to="/specializations"
              className="text-sm font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Specializations
            </Link>
            <Link
              to="/about"
              className="text-sm font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              About
            </Link>
            <div className="flex flex-col gap-2 pt-4 border-t border-border">
              {isAuthenticated ? (
                <>
                  <Button variant="outline" asChild>
                    <Link to="/notifications" onClick={() => setMobileMenuOpen(false)}>
                      <Bell className="h-4 w-4 mr-2" />
                      Notifications {unreadCount > 0 && `(${unreadCount})`}
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to={getDashboardLink()} onClick={() => setMobileMenuOpen(false)}>
                      Dashboard
                    </Link>
                  </Button>
                  <Button variant="destructive" onClick={handleSignOut}>
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" asChild>
                    <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                      Sign In
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link to="/auth?mode=signup" onClick={() => setMobileMenuOpen(false)}>
                      Get Started
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
