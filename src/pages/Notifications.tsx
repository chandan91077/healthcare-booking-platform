import { useEffect, useState } from "react";
import api from "@/lib/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  Bell,
  CalendarCheck,
  CheckCircle2,
  CircleAlert,
  MessageCircle,
  Trash2,
  Video,
  X,
} from "lucide-react";

export default function NotificationsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuthContext();
  const [notifications, setNotifications] = useState<any[]>([]);

  const getNotificationTitle = (notification: any) => {
    const type = notification?.type;
    const appointmentType = notification?.data?.appointment_type;

    if (type === 'new_appointment' && appointmentType === 'emergency') {
      return 'Emergency Booking';
    }

    switch (type) {
      case 'new_message':
        return 'New Message';
      case 'chat_available':
      case 'chat_available_confirmation':
        return 'Chat Enabled';
      case 'chat_disabled':
      case 'chat_disabled_confirmation':
        return 'Chat Disabled';
      case 'video_link':
        return 'Video Link Available';
      case 'video_call_started':
      case 'video_call_started_confirmation':
        return 'Video Session Started';
      case 'video_call_ended':
      case 'video_call_ended_confirmation':
        return 'Video Session Ended';
      case 'appointment_confirmed':
        return 'Appointment Confirmed';
      case 'new_appointment':
        return 'New Appointment';
      case 'payment_pending':
        return 'Payment Pending';
      case 'preempted':
        return 'Appointment Updated';
      default:
        return 'Notification';
    }
  };

  const isEmergencyBooking = (notification: any) => {
    return notification?.type === 'new_appointment' && notification?.data?.appointment_type === 'emergency';
  };

  const getNotificationIcon = (notification: any) => {
    if (isEmergencyBooking(notification)) {
      return CircleAlert;
    }

    switch (notification?.type) {
      case 'chat_available':
      case 'chat_available_confirmation':
      case 'chat_disabled':
      case 'chat_disabled_confirmation':
      case 'new_message':
        return MessageCircle;
      case 'video_link':
      case 'video_call_started':
      case 'video_call_started_confirmation':
      case 'video_call_ended':
      case 'video_call_ended_confirmation':
        return Video;
      case 'appointment_confirmed':
      case 'payment_pending':
        return CheckCircle2;
      case 'new_appointment':
        return CalendarCheck;
      case 'preempted':
        return CircleAlert;
      default:
        return Bell;
    }
  };

  const getNotificationColorClasses = (notification: any) => {
    if (isEmergencyBooking(notification)) {
      return {
        badge: 'bg-red-100 text-red-600',
        accent: 'bg-red-500',
      };
    }

    switch (notification?.type) {
      case 'chat_available':
      case 'chat_available_confirmation':
        return {
          badge: 'bg-green-100 text-green-600',
          accent: 'bg-green-500',
        };
      case 'chat_disabled':
      case 'chat_disabled_confirmation':
      case 'payment_pending':
        return {
          badge: 'bg-orange-100 text-orange-600',
          accent: 'bg-orange-500',
        };
      case 'video_link':
        return {
          badge: 'bg-blue-100 text-blue-600',
          accent: 'bg-blue-500',
        };
      case 'video_call_started':
      case 'video_call_started_confirmation':
        return {
          badge: 'bg-green-100 text-green-600',
          accent: 'bg-green-500',
        };
      case 'video_call_ended':
      case 'video_call_ended_confirmation':
      case 'preempted':
        return {
          badge: 'bg-red-100 text-red-600',
          accent: 'bg-red-500',
        };
      case 'appointment_confirmed':
        return {
          badge: 'bg-teal-100 text-teal-600',
          accent: 'bg-teal-500',
        };
      case 'new_appointment':
        return {
          badge: 'bg-indigo-100 text-indigo-600',
          accent: 'bg-indigo-500',
        };
      default:
        return {
          badge: 'bg-indigo-100 text-indigo-600',
          accent: 'bg-blue-500',
        };
    }
  };

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

  const deleteOne = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
    } catch (err) {
      console.error('Error deleting notification', err);
      toast({ title: 'Failed to delete notification' });
    }
  };

  const clearAll = async () => {
    try {
      await api.delete('/notifications/clear-all');
      setNotifications([]);
      toast({ title: 'All notifications cleared' });
    } catch (err) {
      console.error('Error clearing notifications', err);
      toast({ title: 'Failed to clear notifications' });
    }
  };

  return (
    <MainLayout>
      <div className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-heading text-2xl font-semibold">Notifications</h1>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <>
                <Button onClick={markAllRead} size="sm" variant="outline">Mark all read</Button>
                <Button onClick={clearAll} size="sm" variant="destructive" className="flex items-center gap-1">
                  <Trash2 className="h-4 w-4" />
                  Clear all
                </Button>
              </>
            )}
          </div>
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
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-full ${getNotificationColorClasses(n).badge}`}>
                      {(() => {
                        const Icon = getNotificationIcon(n);
                        return <Icon className="h-5 w-5" />;
                      })()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${getNotificationColorClasses(n).accent} ${n.read ? 'opacity-0' : 'opacity-100'}`} />
                        <CardTitle className="text-sm">{getNotificationTitle(n)}</CardTitle>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="mb-2">{n.message}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      {!n.read && <Button size="sm" onClick={() => markRead(n._id)}>Mark read</Button>}
                      {(n.data?.zoom_join_url || n.data?.url || n.url) && (
                        <Button size="sm" variant="ghost" asChild>
                          <a href={n.data?.zoom_join_url || n.data?.url || n.url} target="_blank" rel="noopener noreferrer">Open Link</a>
                        </Button>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => deleteOne(n._id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
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
