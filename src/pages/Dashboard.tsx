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
        <div className="container py-8">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="grid md:grid-cols-3 gap-6">
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
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold mb-2">
            Welcome back!
          </h1>
          <p className="text-muted-foreground">
            Manage your appointments and healthcare from your dashboard.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <Link to="/doctors" className="flex flex-col items-center text-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Search className="h-6 w-6 text-primary" />
                </div>
                <span className="font-medium">Find Doctors</span>
              </Link>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <Link to="/appointments" className="flex flex-col items-center text-center gap-3">
                <div className="h-12 w-12 rounded-full bg-info/10 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-info" />
                </div>
                <span className="font-medium">Appointments</span>
              </Link>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <Link to="/appointments" className="flex flex-col items-center text-center gap-3">
                <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-success" />
                </div>
                <span className="font-medium">Messages</span>
              </Link>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <Link to="/prescriptions" className="flex flex-col items-center text-center gap-3">
                <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-warning" />
                </div>
                <span className="font-medium">Prescriptions</span>
              </Link>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <Link to="/settings" className="flex flex-col items-center text-center gap-3">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Settings className="h-6 w-6 text-muted-foreground" />
                </div>
                <span className="font-medium">Settings</span>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Appointments */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Upcoming Appointments
              </CardTitle>
              <CardDescription>Your scheduled consultations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No upcoming appointments</p>
                <Button asChild className="mt-4">
                  <Link to="/doctors">Book an Appointment</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Recent Messages
              </CardTitle>
              <CardDescription>Your latest conversations</CardDescription>
            </CardHeader>
            <CardContent>
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
      <div className="text-center py-8 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No messages yet</p>
        <p className="text-sm mt-2">Messages will appear here after booking an appointment</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {conversations.slice(0, 3).map((c) => (
        <li key={c.appointment_id} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{(c.otherPartyName || 'U').charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium flex items-center gap-2">
                {c.otherPartyName}
                {c.appointmentCount > 1 && (
                  <Badge variant="secondary" className="text-xs">
                    {c.appointmentCount} appointments
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground truncate w-72">
                {c.lastMessage ? c.lastMessage.content : 'No messages yet'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {c.unreadCount > 0 && <Badge variant="destructive">{c.unreadCount}</Badge>}
            {(c.video?.enabled) ? (
              <Video className="h-6 w-6 text-emerald-600 hover:text-emerald-700 cursor-pointer" title="Video enabled" />
            ) : (
              <Video className="h-6 w-6 text-red-600 hover:text-red-700 cursor-pointer" title="Video disabled" />
            )}
            <Button size="sm" asChild>
              <Link to={`/chat/${c.appointment_id}`}>Open</Link>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
