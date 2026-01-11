import { useEffect, useState } from "react";
import api from "@/lib/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export default function NotificationsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuthContext();
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) return;
    fetchNotifications();
  }, [authLoading, isAuthenticated]);

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications', err);
    }
  };

  const markRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error('Error marking read', err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast({ title: 'All notifications marked read' });
    } catch (err) {
      console.error('Error marking all read', err);
      toast({ title: 'Failed to mark all read' });
    }
  };

  return (
    <MainLayout>
      <div className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-heading text-2xl font-semibold">Notifications</h1>
          <Button onClick={markAllRead} size="sm">Mark all read</Button>
        </div>

        <div className="space-y-4">
          {notifications.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">No notifications</CardContent>
            </Card>
          ) : (
            notifications.map((n) => (
              <Card key={n._id} className={n.read ? 'opacity-60' : ''}>
                <CardHeader>
                  <CardTitle className="text-sm">{n.type}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-2">{n.message}</p>
                  <div className="flex gap-2">
                    {!n.read && <Button size="sm" onClick={() => markRead(n._id)}>Mark read</Button>}
                    {(n.data?.zoom_join_url || n.data?.url || n.url) && (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={n.data?.zoom_join_url || n.data?.url || n.url} target="_blank" rel="noopener noreferrer">Open Link</a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
}
