import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuthContext } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Video } from "lucide-react";

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
  chat_unlocked?: boolean;
  appointmentCount?: number;
  video?: {
    doctorInCall?: boolean;
  } | null;
}

export default function Messages() {
  const { role, isLoading, isAuthenticated } = useAuthContext();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
      return;
    }
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    async function fetchConversations() {
      try {
        const { data } = await api.get('/messages/conversations');
        setConversations(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load conversations', error);
      } finally {
        setLoading(false);
      }
    }

    if (!isLoading && isAuthenticated) {
      fetchConversations();
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading || loading) {
    return (
      <MainLayout>
        <div className="container py-8">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Messages</CardTitle>
            <CardDescription>
              {role === "patient" ? "All doctor chats" : "All patient chats"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {conversations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No conversations yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {conversations.map((conversation) => (
                  <div key={conversation.appointment_id} className="flex items-center justify-between border rounded-lg p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar>
                        <AvatarFallback>{(conversation.otherPartyName || "U").charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{conversation.otherPartyName || "Unknown"}</p>
                          {conversation.chat_unlocked ? (
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full bg-green-500"
                              title="Chat enabled"
                              aria-label="Chat enabled"
                            />
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {conversation.lastMessage?.content || "No messages yet"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {conversation.appointmentCount && conversation.appointmentCount > 1 ? (
                        <Badge variant="secondary">{conversation.appointmentCount} chats</Badge>
                      ) : null}
                      {conversation.unreadCount > 0 ? (
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-white">
                          {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                        </span>
                      ) : null}
                      {conversation.video?.doctorInCall ? (
                        <Video className="h-5 w-5 text-green-500" />
                      ) : null}
                      <Button asChild size="sm">
                        <Link to={`/chat/${conversation.appointment_id}`}>Open</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}