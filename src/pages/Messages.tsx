import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, ArrowLeft } from "react-router-dom";
import api from "@/lib/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Video,
  ArrowLeft as ArrowLeftIcon,
} from "lucide-react";

interface Conversation {
  appointment_id: string;
  lastMessage: {
    _id: string;
    content: string;
    createdAt: string;
    senderName: string | null;
  } | null;
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
  appointmentCount: number;
}

export default function Messages() {
  const { user, role, isLoading, isAuthenticated } = useAuthContext();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    async function fetchConversations() {
      try {
        setLoading(true);
        const { data } = await api.get('/messages/conversations');
        setConversations(data || []);
      } catch (err) {
        console.error('Failed to load conversations', err);
        setConversations([]);
      } finally {
        setLoading(false);
      }
    }

    fetchConversations();
  }, []);

  if (isLoading || loading) {
    return (
      <MainLayout>
        <div className="container py-8">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container py-8 max-w-4xl">
        {/* Back button */}
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-6 w-6" />
              Your Messages
            </CardTitle>
            <CardDescription>
              {conversations.length === 0
                ? "Your latest conversations will appear here after booking an appointment"
                : `You have ${conversations.length} conversation${conversations.length !== 1 ? 's' : ''}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {conversations.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-muted-foreground mb-2">No messages yet</p>
                <p className="text-sm text-muted-foreground mb-6">
                  Messages will appear here after you start a conversation with a doctor
                </p>
                <Button asChild>
                  <Link to="/doctors">Find a Doctor</Link>
                </Button>
              </div>
            ) : (
              <ul className="space-y-3">
                {conversations.map((c) => (
                  <li
                    key={c.appointment_id}
                    className="flex items-center justify-between p-4 hover:bg-accent rounded-lg transition-colors border"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Avatar>
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {(c.otherPartyName || 'U').charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium flex items-center gap-2 flex-wrap">
                          {c.otherPartyName}
                          {c.appointmentCount > 1 && (
                            <Badge variant="secondary" className="text-xs">
                              {c.appointmentCount} appointments
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {c.lastMessage ? c.lastMessage.content : 'No messages yet'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {c.unreadCount > 0 && (
                        <Badge variant="destructive" className="shrink-0">
                          {c.unreadCount}
                        </Badge>
                      )}
                      {(c.video?.enabled) ? (
                        <Video
                          className="h-6 w-6 text-emerald-600 hover:text-emerald-700 cursor-pointer shrink-0"
                          title="Video enabled"
                        />
                      ) : (
                        <Video
                          className="h-6 w-6 text-red-600 hover:text-red-700 cursor-pointer shrink-0"
                          title="Video disabled"
                        />
                      )}
                      <Button size="sm" asChild className="shrink-0">
                        <Link to={`/chat/${c.appointment_id}`}>Open</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
