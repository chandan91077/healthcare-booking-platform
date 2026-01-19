import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  MessageSquare,
  FileText,
  Search,
  Clock,
  Settings,
  Video,
} from "lucide-react";

interface Conversation {
  appointment_id: string;
  lastMessage: {
    _id: string;
    content: string;
    createdAt: string;
    senderName: string | null;
  };
  unreadCount: number;
  otherPartyName: string;
  video: {
    provider: string;
    meetingId: string | null;
    doctorJoinUrl: string | null;
    patientJoinUrl: string | null;
    enabled: boolean;
    enabledAt: Date | null;
  } | null;
}

export default function Dashboard() {
  const { user, role, isLoading, isAuthenticated } = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && role === "doctor") {
      navigate("/doctor");
    }
    if (!isLoading && role === "admin") {
      navigate("/admin");
    }
  }, [isLoading, isAuthenticated, role, navigate]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container px-4 sm:px-6 py-6 sm:py-8">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold mb-2">
            Welcome back!
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage your appointments and healthcare from your dashboard.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4 mb-6 sm:mb-8">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-3 sm:p-6">
              <Link to="/doctors" className="flex flex-col items-center text-center gap-2 sm:gap-3">
                <div className="h-10 sm:h-12 w-10 sm:w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Search className="h-5 sm:h-6 w-5 sm:w-6 text-primary" />
                </div>
                <span className="font-medium text-xs sm:text-sm">Find Doctors</span>
              </Link>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-3 sm:p-6">
              <Link to="/appointments" className="flex flex-col items-center text-center gap-2 sm:gap-3">
                <div className="h-10 sm:h-12 w-10 sm:w-12 rounded-full bg-info/10 flex items-center justify-center">
                  <Calendar className="h-5 sm:h-6 w-5 sm:w-6 text-info" />
                </div>
                <span className="font-medium text-xs sm:text-sm">Appointments</span>
              </Link>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-3 sm:p-6">
              <Link to="/messages" className="flex flex-col items-center text-center gap-2 sm:gap-3">
                <div className="h-10 sm:h-12 w-10 sm:w-12 rounded-full bg-success/10 flex items-center justify-center">
                  <MessageSquare className="h-5 sm:h-6 w-5 sm:w-6 text-success" />
                </div>
                <span className="font-medium text-xs sm:text-sm">Messages</span>
              </Link>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-3 sm:p-6">
              <Link to="/prescriptions" className="flex flex-col items-center text-center gap-2 sm:gap-3">
                <div className="h-10 sm:h-12 w-10 sm:w-12 rounded-full bg-warning/10 flex items-center justify-center">
                  <FileText className="h-5 sm:h-6 w-5 sm:w-6 text-warning" />
                </div>
                <span className="font-medium text-xs sm:text-sm">Prescriptions</span>
              </Link>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow col-span-2 sm:col-span-1">
            <CardContent className="p-3 sm:p-6">
              <Link to="/settings" className="flex flex-col items-center text-center gap-2 sm:gap-3">
                <div className="h-10 sm:h-12 w-10 sm:w-12 rounded-full bg-muted flex items-center justify-center">
                  <Settings className="h-5 sm:h-6 w-5 sm:w-6 text-muted-foreground" />
                </div>
                <span className="font-medium text-xs sm:text-sm">Settings</span>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Appointments */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
                <Clock className="h-4 sm:h-5 w-4 sm:w-5" />
                Upcoming Appointments
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Your scheduled consultations</CardDescription>
            </CardHeader>
            <CardContent className="text-center py-6 sm:py-8 text-xs sm:text-sm text-muted-foreground p-4 sm:p-6">
                <Calendar className="h-10 sm:h-12 w-10 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                <p className="text-sm">No upcoming appointments</p>
                <Button asChild className="mt-3 sm:mt-4 text-xs sm:text-sm h-9">
                  <Link to="/doctors">Book an Appointment</Link>
                </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
                <MessageSquare className="h-4 sm:h-5 w-4 sm:w-5" />
                Recent Messages
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Your latest conversations</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {/* Conversations list */}
              <RecentMessages />
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}

// Small component to render recent conversations
function RecentMessages() {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    async function fetchConvs() {
      try {
        const { data } = await api.get('/messages/conversations');
        setConversations(data || []);
      } catch (err) {
        console.error('Failed to load conversations', err);
      }
    }

    fetchConvs();
  }, []);

  if (conversations.length === 0) {
    return (
      <div className="text-center py-6 sm:py-8 text-muted-foreground">
        <MessageSquare className="h-10 sm:h-12 w-10 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
        <p className="text-sm">No messages yet</p>
        <p className="text-xs sm:text-sm mt-2">Messages will appear here after booking an appointment</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2 sm:space-y-3">
      {conversations.slice(0, 3).map((c) => (
        <li key={c.appointment_id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 p-2 sm:p-0 border sm:border-0 rounded-lg sm:rounded-none">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <Avatar className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
              <AvatarFallback className="text-sm">{(c.otherPartyName || 'U').charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-medium flex items-center gap-2 text-sm sm:text-base flex-wrap">
                {c.otherPartyName}
                {c.appointmentCount > 1 && (
                  <Badge variant="secondary" className="text-xs">
                    {c.appointmentCount} appointments
                  </Badge>
                )}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-[280px]">
                {c.lastMessage ? c.lastMessage.content : 'No messages yet'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end sm:justify-start">
            {c.unreadCount > 0 && <Badge variant="destructive" className="text-xs h-5 px-2">{c.unreadCount}</Badge>}
            {(c.video?.enabled) ? (
              <Video className="h-5 sm:h-6 w-5 sm:w-6 text-emerald-600 hover:text-emerald-700 cursor-pointer" title="Video enabled" />
            ) : (
              <Video className="h-5 sm:h-6 w-5 sm:w-6 text-red-600 hover:text-red-700 cursor-pointer" title="Video disabled" />
            )}
            <Button size="sm" asChild className="text-xs sm:text-sm h-8 sm:h-9">
              <Link to={`/chat/${c.appointment_id}`}>Open</Link>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
