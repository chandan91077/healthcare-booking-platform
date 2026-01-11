import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuthContext } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, isToday, isFuture, isPast } from "date-fns";
import {
  Calendar,
  Clock,
  Video,
  MessageSquare,
  FileText,
  IndianRupee,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { PrescriptionModal } from "@/components/PrescriptionModal";

interface Appointment {
  _id: string;
  id: string; // fallback
  appointment_date: string;
  appointment_time: string;
  appointment_type: string;
  amount: number;
  status: string;
  payment_status: string;
  chat_unlocked: boolean;
  video_unlocked: boolean;
  zoom_join_url: string | null;
  video: {
    provider: string;
    meetingId: string;
    doctorJoinUrl: string;
    patientJoinUrl: string;
    enabled: boolean;
    enabledAt: string | null;
  };
  doctor_id: any;
  patient_id: any;
  doctor: {
    id: string;
    specialization: string;
    profile: {
      full_name: string;
    } | null;
  } | null;
  patient: {
    full_name: string;
  } | null;
}

export default function Appointments() {
  const { user, role, isLoading: authLoading, isAuthenticated } = useAuthContext();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Notifications for patient (e.g., preempted by emergency)
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showPreemptedDialog, setShowPreemptedDialog] = useState(false);
  const [activePreempted, setActivePreempted] = useState<any | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    async function fetchAppointments() {
      if (!user?._id && !user?.id) return;

      try {
        const { data } = await api.get('/appointments');

        const mappedAppointments = data.map((appt: any) => ({
          ...appt,
          id: appt._id,
          doctor: appt.doctor_id ? {
            id: appt.doctor_id._id,
            specialization: appt.doctor_id.specialization,
            profile: { full_name: "Dr. " + (appt.doctor_id.user_id?.full_name || "Unknown") }
          } : null,
          patient: appt.patient_id ? {
            full_name: appt.patient_id.full_name
          } : null
        }));

        setAppointments(mappedAppointments);

        // Fetch notifications and show any unread preempted notifications (patient-facing)
        try {
          const { data: notifs } = await api.get('/notifications');
          // show first unread preempted notification
          const firstPreempted = notifs && notifs.find((n: any) => n.type === 'preempted' && !n.read);
          if (firstPreempted) {
            setNotifications(notifs);
            setActivePreempted(firstPreempted);
            setShowPreemptedDialog(true);
          }

          // show video link notifications as a toast for quick access
          const firstVideo = notifs && notifs.find((n: any) => n.type === 'video_link' && !n.read);
          if (firstVideo) {
            toast.info(firstVideo.message);
            // leave it unread so user can view/ack later
            setNotifications(notifs);
          }
        } catch (nerr) {
          console.error('Error fetching notifications', nerr);
        }

      } catch (error) {
        console.error("Error fetching appointments:", error);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading && (user?._id || user?.id)) {
      fetchAppointments();
    }
  }, [user, role, authLoading]);

  const upcomingAppointments = appointments.filter(
    (a) => (a.status === "confirmed" || a.status === "pending") && (isFuture(new Date(a.appointment_date)) || isToday(new Date(a.appointment_date)))
  );
  const pendingAppointments = appointments.filter((a) => a.status === "pending");
  const pastAppointments = appointments.filter(
    (a) => a.status === "completed" || (a.status === "confirmed" && isPast(new Date(a.appointment_date)))
  );
  const cancelledAppointments = appointments.filter((a) => a.status === "cancelled");

  const getStatusBadge = (status: string, paymentStatus: string) => {
    if (paymentStatus === "pending") {
      return <Badge variant="secondary">Payment Pending</Badge>;
    }
    switch (status) {
      case "confirmed":
        return <Badge className="bg-success text-success-foreground">Confirmed</Badge>;
      case "completed":
        return <Badge variant="secondary">Completed</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Small component for doctor to manage video link and enabling video
  const DoctorVideoControls = ({ appointment }: { appointment: Appointment }) => {
    const [zoomLink, setZoomLink] = useState<string>(appointment.zoom_join_url || '');
    const [loading, setLoading] = useState(false);
    const [provider, setProvider] = useState<string>(appointment.meeting_provider || 'zoom');
    const [scheduledAt, setScheduledAt] = useState<string | null>(appointment.meeting_time || null);

    const generate = () => {
      setZoomLink(`https://zoom.us/j/${appointment.id.slice(-8)}`);
    };

    const enableAndSend = async (send = true) => {
      try {
        setLoading(true);
        await api.put(`/appointments/${appointment.id}/permissions`, { video_unlocked: true, zoom_join_url: zoomLink || undefined, auto_send: !!send, meeting_provider: provider, meeting_time: scheduledAt });
        toast.success(send ? 'Video enabled and link sent' : 'Video enabled');
        // refetch appointments
        const { data } = await api.get('/appointments');
        const mappedAppointments = data.map((appt: any) => ({
          ...appt,
          id: appt._id,
          doctor: appt.doctor_id ? {
            id: appt.doctor_id._id,
            specialization: appt.doctor_id.specialization,
            profile: { full_name: "Dr. " + (appt.doctor_id.user_id?.full_name || "Unknown") }
          } : null,
          patient: appt.patient_id ? { full_name: appt.patient_id.full_name } : null
        }));
        setAppointments(mappedAppointments);
      } catch (err) {
        console.error('Error enabling video', err);
        toast.error('Failed to enable video');
      } finally {
        setLoading(false);
      }
    };

    if (appointment.video_unlocked) {
      return (
        <div className="flex items-center gap-2">
          {appointment.zoom_join_url && (
            <a className="text-sm text-primary underline" href={appointment.zoom_join_url} target="_blank" rel="noopener noreferrer">Open Link</a>
          )}
          <span className="text-xs text-muted-foreground">Video enabled</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Input value={zoomLink} onChange={(e: any) => setZoomLink(e.target.value)} placeholder="Enter or generate link" className="w-52" />
        <select value={provider} onChange={(e) => setProvider(e.target.value)} className="input input-sm">
          <option value="zoom">Zoom</option>
          <option value="meet">Google Meet</option>
        </select>
        <input type="datetime-local" value={scheduledAt || ''} onChange={(e) => setScheduledAt(e.target.value || null)} className="input input-sm" />
        <Button size="sm" onClick={generate} disabled={loading}>Generate</Button>
        <Button size="sm" onClick={() => enableAndSend(true)} disabled={loading}>Enable & Send</Button>
        <Button size="sm" variant="outline" onClick={() => enableAndSend(false)} disabled={loading}>Enable Only</Button>
      </div>
    );
  };

  const AppointmentCard = ({ appointment }: { appointment: Appointment }) => {
    const appointmentDate = new Date(appointment.appointment_date);
    // Allow doctors to access chat even if payment is pending; patient access still requires paid/confirmed/emergency
    const canAccessChat = appointment.chat_unlocked && (role === 'doctor' || appointment.payment_status === "paid" || appointment.status === 'confirmed' || appointment.appointment_type === 'emergency');
    const canAccessVideo = appointment.video_unlocked && (appointment.payment_status === "paid" || appointment.status === 'confirmed' || appointment.appointment_type === 'emergency');
    const isDoctor = role === "doctor";
    const canPrescribe = isDoctor && (appointment.status === "confirmed" || appointment.status === "completed");

    // show a visual marker if this appointment was preempted by an emergency (notes contain it)
    const wasPreempted = appointment.status === 'cancelled' && appointment.notes && appointment.notes.includes('Preempted by emergency');

    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              {isDoctor ? (
                <>
                  <h3 className="font-heading font-semibold">
                    {appointment.patient?.full_name || "Unknown Patient"}
                  </h3>
                  <p className="text-sm text-muted-foreground">Patient</p>
                </>
              ) : (
                <>
                  <h3 className="font-heading font-semibold">
                    Dr. {appointment.doctor?.profile?.full_name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {appointment.doctor?.specialization}
                  </p>
                </>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {getStatusBadge(appointment.status, appointment.payment_status)}
              <Badge variant={appointment.appointment_type === "emergency" ? "destructive" : "outline"}>
                {appointment.appointment_type}
              </Badge>
              {wasPreempted && (
                <p className="text-xs text-destructive">Cancelled due to emergency booking</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{format(appointmentDate, "MMM d, yyyy")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{appointment.appointment_time.slice(0, 5)}</span>
            </div>
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
              <span>₹{appointment.amount}</span>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            {appointment.payment_status === "pending" && role === 'patient' && (
              <Button size="sm" asChild>
                <Link to={`/payment/${appointment.id}`}>Complete Payment</Link>
              </Button>
            )}
            {canAccessChat && (
              <Button size="sm" variant="outline" asChild>
                <Link to={`/chat/${appointment._id || appointment.id}`}>
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Chat
                </Link>
              </Button>
            )}
            {canAccessVideo && appointment.video?.enabled && appointment.video.patientJoinUrl && (
              <Button size="sm" variant="outline" asChild>
                <a
                  href={appointment.video.patientJoinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    window.open(appointment.video.patientJoinUrl, '_blank', 'noopener,noreferrer');
                  }}
                >
                  <Video className="h-4 w-4 mr-1" />
                  Join Video
                </a>
              </Button>
            )}

            {role === 'doctor' && (
              <div className="flex items-center gap-2">
                {/* Chat enable/disable */}
                {!appointment.chat_unlocked ? (
                  <Button size="sm" variant="secondary" onClick={async () => {
                    try {
                      await api.put(`/appointments/${appointment._id || appointment.id}/permissions`, { chat_unlocked: true });
                      toast.success('Chat enabled for this appointment');
                      // refetch appointments
                      const { data } = await api.get('/appointments');
                      const mappedAppointments = data.map((appt: any) => ({
                        ...appt,
                        id: appt._id,
                        doctor: appt.doctor_id ? {
                          id: appt.doctor_id._id,
                          specialization: appt.doctor_id.specialization,
                          profile: { full_name: "Dr. " + (appt.doctor_id.user_id?.full_name || "Unknown") }
                        } : null,
                        patient: appt.patient_id ? { full_name: appt.patient_id.full_name } : null
                      }));
                      setAppointments(mappedAppointments);
                    } catch (err) {
                      console.error('Error enabling chat', err);
                      toast.error('Failed to enable chat');
                    }
                  }}>Enable Chat</Button>
                ) : (
                  <>
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/chat/${appointment._id || appointment.id}`}>
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Chat
                      </Link>
                    </Button>
                    <Button size="sm" variant="destructive" onClick={async () => {
                      try {
                        await api.put(`/appointments/${appointment._id || appointment.id}/permissions`, { chat_unlocked: false });
                        toast.success('Chat disabled for this appointment');
                        const { data } = await api.get('/appointments');
                        const mappedAppointments = data.map((appt: any) => ({
                          ...appt,
                          id: appt._id,
                          doctor: appt.doctor_id ? {
                            id: appt.doctor_id._id,
                            specialization: appt.doctor_id.specialization,
                            profile: { full_name: "Dr. " + (appt.doctor_id.user_id?.full_name || "Unknown") }
                          } : null,
                          patient: appt.patient_id ? { full_name: appt.patient_id.full_name } : null
                        }));
                        setAppointments(mappedAppointments);
                      } catch (err) {
                        console.error('Error disabling chat', err);
                        toast.error('Failed to disable chat');
                      }
                    }}>Disable Chat</Button>
                  </>
                )}

                {/* Video / Zoom link */}
                <DoctorVideoControls appointment={appointment} />
              </div>
            )}

            {canPrescribe && (
              <PrescriptionModal
                appointmentId={appointment._id}
                patientId={appointment.patient_id?._id || appointment.patient_id}
                patientName={appointment.patient?.full_name || "Patient"}
                doctorId={appointment.doctor_id?._id || appointment.doctor_id}
                doctorName={appointment.doctor?.profile?.full_name || "Doctor"}
                doctorSpecialization={appointment.doctor?.specialization || "Physician"}
              />
            )}

            <Button size="sm" variant="ghost" asChild>
              <Link to={`/appointment/${appointment.id}`}>View Details</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading || authLoading) {
    return (
      <MainLayout>
        <div className="container py-8">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold mb-2">
              {role === "doctor" ? "Patient Appointments" : "My Appointments"}
            </h1>
            <p className="text-muted-foreground">
              {role === "doctor" ? "Manage your patient consultations" : "Manage your healthcare appointments"}
            </p>
          </div>
          {role === "patient" && (
            <Button asChild>
              <Link to="/doctors">Book New Appointment</Link>
            </Button>
          )}
        </div>

        <Tabs defaultValue="upcoming">
          <TabsList className="mb-6">
            <TabsTrigger value="upcoming" className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Upcoming ({upcomingAppointments.length})
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-2">
              <AlertCircle className="h-4 w-4" />
              Pending ({pendingAppointments.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="gap-2">
              <Clock className="h-4 w-4" />
              Past ({pastAppointments.length})
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="gap-2">
              <XCircle className="h-4 w-4" />
              Cancelled ({cancelledAppointments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            {upcomingAppointments.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="font-heading text-xl font-semibold mb-2">
                    No Upcoming Appointments
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    You don't have any scheduled appointments
                  </p>
                  <Button asChild>
                    <Link to="/doctors">Find a Doctor</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {upcomingAppointments.map((appt) => (
                  <AppointmentCard key={appt.id} appointment={appt} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending">
            {pendingAppointments.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <AlertCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>No pending appointments</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {pendingAppointments.map((appt) => (
                  <AppointmentCard key={appt.id} appointment={appt} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past">
            {pastAppointments.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <Clock className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>No past appointments</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {pastAppointments.map((appt) => (
                  <AppointmentCard key={appt.id} appointment={appt} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="cancelled">
            {cancelledAppointments.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <XCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>No cancelled appointments</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {cancelledAppointments.map((appt) => (
                  <AppointmentCard key={appt.id} appointment={appt} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Preempted notification dialog */}
      <Dialog open={showPreemptedDialog} onOpenChange={(open) => { if (!open) { setShowPreemptedDialog(false); setActivePreempted(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appointment Preempted by Emergency</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm">{activePreempted?.message}</p>
          </div>
          <DialogFooter>
            <Button onClick={async () => {
              try {
                if (!activePreempted) return;
                await api.put(`/notifications/${activePreempted._id}/read`);
                setNotifications((prev) => prev.map((n) => n._id === activePreempted._id ? { ...n, read: true } : n));
                setShowPreemptedDialog(false);
                setActivePreempted(null);
                // refetch appointments
                const { data } = await api.get('/appointments');
                const mappedAppointments = data.map((appt: any) => ({
                  ...appt,
                  id: appt._id,
                  doctor: appt.doctor_id ? {
                    id: appt.doctor_id._id,
                    specialization: appt.doctor_id.specialization,
                    profile: { full_name: "Dr. " + (appt.doctor_id.user_id?.full_name || "Unknown") }
                  } : null,
                  patient: appt.patient_id ? {
                    full_name: appt.patient_id.full_name
                  } : null
                }));
                setAppointments(mappedAppointments);
              } catch (err) {
                console.error('Error acknowledging notification', err);
              }
            }}>Acknowledge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </MainLayout>
  );
}
