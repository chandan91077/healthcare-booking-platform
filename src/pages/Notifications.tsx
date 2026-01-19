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

  const clearAll = async () => {
    try {
      const { data } = await api.delete('/notifications/clear-all');
      setNotifications([]);
      toast({ title: `Cleared ${data?.deletedCount ?? 0} notifications` });
    } catch (err) {
      console.error('Error clearing notifications', err);
      toast({ title: 'Failed to clear notifications' });
    }
  };

  // Get notification type color
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'video_link':
        return 'border-l-4 border-l-blue-500 bg-blue-50/30';
      case 'chat_available':
        return 'border-l-4 border-l-green-500 bg-green-50/30';
      case 'appointment_confirmed':
        return 'border-l-4 border-l-emerald-500 bg-emerald-50/30';
      case 'payment_success':
        return 'border-l-4 border-l-purple-500 bg-purple-50/30';
      case 'preempted':
        return 'border-l-4 border-l-red-500 bg-red-50/30';
      default:
        return 'border-l-4 border-l-gray-500 bg-gray-50/30';
    }
  };

  // Get notification type label
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'video_link':
        return '📹 Video Call';
      case 'chat_available':
        return '💬 Chat Available';
      case 'chat_available_confirmation':
        return '💬 Chat Enabled';
      case 'chat_disabled':
        return '💬 Chat Disabled';
      case 'appointment_confirmed':
        return '✅ Appointment Confirmed';
      case 'payment_success':
        return '💰 Payment Success';
      case 'preempted':
        return '⚠️ Appointment Cancelled';
      case 'message':
        return '💌 New Message';
      default:
        return `📬 ${type}`;
    }
  };

  return (
    <MainLayout>
      <div className="container px-4 sm:px-6 py-4 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <h1 className="font-heading text-2xl sm:text-3xl font-semibold">Notifications</h1>
          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={markAllRead} 
              size="sm" 
              variant="outline"
              className="text-xs sm:text-sm h-9 sm:h-10"
            >
              Mark all read
            </Button>
            <Button 
              onClick={clearAll} 
              size="sm" 
              variant="destructive"
              className="text-xs sm:text-sm h-9 sm:h-10"
            >
              Clear all
            </Button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-3 sm:space-y-4">
          {notifications.length === 0 ? (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center text-muted-foreground">
                <p className="text-sm sm:text-base">No notifications</p>
              </CardContent>
            </Card>
          ) : (
            notifications.map((n) => (
              <Card 
                key={n._id} 
                className={`transition-all ${getTypeColor(n.type)} ${n.read ? 'opacity-60' : 'ring-1 ring-blue-200'}`}
              >
                <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
                  <CardTitle className="text-base sm:text-lg flex items-center justify-between">
                    <span>{getTypeLabel(n.type)}</span>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0"></span>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-2 sm:pt-3">
                  <p className="text-sm sm:text-base text-foreground mb-4 leading-relaxed">{n.message}</p>
                  <div className="flex flex-wrap gap-2">
                    {!n.read && (
                      <Button 
                        size="sm" 
                        onClick={() => markRead(n._id)}
                        className="text-xs sm:text-sm h-8 sm:h-9"
                      >
                        Mark read
                      </Button>
                    )}
                    {(n.data?.zoom_join_url || n.data?.url || n.url) && (
                      <Button 
                        size="sm" 
                        variant="default"
                        className="text-xs sm:text-sm h-8 sm:h-9"
                        asChild
                      >
                        <a 
                          href={n.data?.zoom_join_url || n.data?.url || n.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          Open Link
                        </a>
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
