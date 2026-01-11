import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { getDoctorProfile, getProfile } from "@/lib/auth";
import api from "@/lib/api";
import { uploadToS3 } from "@/lib/s3-upload";
import { MainLayout } from "@/components/layout/MainLayout";
import { PrescriptionModal } from "@/components/PrescriptionModal";
import { PatientHistoryModal } from "@/components/PatientHistoryModal";
import { DoctorAvailability } from "@/components/DoctorAvailability";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format, isFuture } from "date-fns";
import { toast } from "sonner";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  MessageSquare,
  Video,
  Users,
  IndianRupee,
  FileText,
  AlertTriangle,
  Camera,
  Loader2,
  MapPin,
} from "lucide-react";

interface DoctorData {
  _id: string; // Added to fix lint error
  id: string;
  is_verified: boolean;
  verification_status: string;
  rejection_reason: string | null;
  specialization: string;
  consultation_fee: number;
  emergency_fee: number;
  medical_license_url: string | null;
  profile_image_url: string | null;
  created_at: string;
  state?: string;
  location?: string;
}

interface DoctorProfile {
  full_name: string;
}

interface Appointment {
  _id: string;
  id: string;
  patient_id: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type: string;
  amount: number;
  status: string;
  payment_status: string;
  chat_unlocked: boolean;
  video_unlocked: boolean;
  zoom_start_url: string | null;
  patient: {
    _id: string;
    full_name: string;
    email: string;
  } | null;
}

export default function DoctorDashboard() {
  const { user, role, isLoading, isAuthenticated } = useAuthContext();
  const navigate = useNavigate();
  const [doctorData, setDoctorData] = useState<DoctorData | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingDoctor, setLoadingDoctor] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState({
    todayCount: 0,
    pendingCount: 0,
    totalEarnings: 0,
    totalPatients: 0,
  });

  const fetchDoctorDashboardData = async () => {
    if (user?.id || user?._id) {
      const userId = user._id || user.id;
      const data = await getDoctorProfile(userId);
      setDoctorData(data);

      if (!data) {
        navigate("/doctor/register");
        return;
      }

      const profile = await getProfile(userId);
      if (profile) {
        setDoctorProfile({ full_name: profile.full_name });
      }

      if (data.is_verified) {
        try {
          const { data: appointmentsData } = await api.get('/appointments');
          const mappedAppointments = appointmentsData.map((appt: any) => ({
            ...appt,
            id: appt._id,
            patient: appt.patient_id ? {
              _id: appt.patient_id._id,
              full_name: appt.patient_id.full_name,
              email: appt.patient_id.email
            } : null
          }));

          setAppointments(mappedAppointments);

          const today = format(new Date(), "yyyy-MM-dd");
          const todayAppts = mappedAppointments.filter(
            (a: any) => a.appointment_date === today && a.status === "confirmed"
          );
          const pendingAppts = mappedAppointments.filter(
            (a: any) => a.status === "pending"
          );
          const completedAppts = mappedAppointments.filter(
            (a: any) => a.status === "completed" || a.payment_status === "completed"
          );

          const uniquePatients = new Set(completedAppts.map((a: any) => a.patient?._id).filter(Boolean));
          const totalEarnings = completedAppts.reduce((sum: number, a: any) => sum + (a.amount || 0), 0);

          setStats({
            todayCount: todayAppts.length,
            pendingCount: pendingAppts.length,
            totalEarnings,
            totalPatients: uniquePatients.size,
          });
        } catch (error) {
          console.error("Error fetching dashboard data", error);
        }
      }
      setLoadingDoctor(false);
    }
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
      return;
    }
    if (!isLoading && role === "patient") {
      navigate("/dashboard");
      return;
    }
    if (!isLoading && role === "admin") {
      navigate("/admin");
      return;
    }
  }, [isLoading, isAuthenticated, role, navigate]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && role === "doctor") {
      fetchDoctorDashboardData();
    }
  }, [user, isLoading, isAuthenticated, role]);

  const handleUpdateStatus = async (appointmentId: string, status: string) => {
    try {
      await api.put(`/appointments/${appointmentId}`, { status });
      await fetchDoctorDashboardData();
      toast.success(`Appointment ${status}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update appointment");
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !doctorData) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Photo must be less than 2MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    setUploadingPhoto(true);
    try {
      const url = await uploadToS3(file);

      if (url) {
        // Update doctor profile with new image URL
        // Assuming PUT /doctors/:id or PUT /doctors/me
        // Since we have doctorData.id (which is _id in mongo usually), we can try updating
        // Note: My current doctor routes don't explicitly have UPDATE. I might need to add it.
        // For now, let's assume I can add it or it exists. 
        // Actually, I didn't add UPDATE route in `server/routes/doctors.js`.
        // I should add it.

        // Temporary fix: just update state, but backend won't save without route.
        // I'll add the route in next step.
        await api.put(`/doctors/${doctorData.id}`, { profile_image_url: url });

        setDoctorData((prev) => prev ? { ...prev, profile_image_url: url } : null);
        toast.success("Profile photo updated!");
      }

    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (isLoading || loadingDoctor) {
    return (
      <MainLayout>
        <div className="container py-8">
          <Skeleton className="h-8 w-48 mb-8" />
          <Skeleton className="h-64" />
        </div>
      </MainLayout>
    );
  }

  // Show waiting for verification page if not verified
  if (doctorData && !doctorData.is_verified) {
    return (
      <MainLayout>
        <div className="container py-8 max-w-2xl mx-auto">
          <Card className="text-center">
            <CardHeader>
              {doctorData.verification_status === "pending" ? (
                <>
                  <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-warning/10 flex items-center justify-center">
                    <Clock className="h-8 w-8 text-warning" />
                  </div>
                  <CardTitle className="text-2xl">Verification Pending</CardTitle>
                  <CardDescription className="text-base">
                    Your application is being reviewed by our admin team
                  </CardDescription>
                </>
              ) : (
                <>
                  <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                    <XCircle className="h-8 w-8 text-destructive" />
                  </div>
                  <CardTitle className="text-2xl">Verification Rejected</CardTitle>
                  <CardDescription className="text-base">
                    Unfortunately, your application was not approved
                  </CardDescription>
                </>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {doctorData.verification_status === "pending" ? (
                <>
                  <div className="bg-muted rounded-lg p-4 text-left space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Submitted Documents
                    </h3>
                    <div className="flex items-center gap-2">
                      <Badge variant={doctorData.medical_license_url ? "default" : "secondary"}>
                        {doctorData.medical_license_url ? (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 mr-1" />
                        )}
                        Medical License
                      </Badge>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground space-y-2">
                    <p><strong>Specialization:</strong> {doctorData.specialization}</p>
                    <p><strong>Submitted on:</strong> {new Date(doctorData.created_at).toLocaleDateString()}</p>
                  </div>

                  <div className="bg-info/10 rounded-lg p-4 text-sm text-info">
                    Verification typically takes 1-2 business days. You will be notified once your account is verified.
                  </div>
                </>
              ) : (
                <>
                  {doctorData.rejection_reason && (
                    <div className="bg-destructive/10 rounded-lg p-4 text-left">
                      <h3 className="font-semibold text-destructive mb-2">Reason for Rejection</h3>
                      <p className="text-sm">{doctorData.rejection_reason}</p>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    If you believe this was an error or would like to reapply with updated documents, please contact our support team.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // Verified doctor dashboard
  const todayAppointments = appointments.filter(
    (a) => a.appointment_date === format(new Date(), "yyyy-MM-dd") && a.status === "confirmed"
  );
  const upcomingAppointments = appointments.filter(
    (a) => isFuture(new Date(a.appointment_date)) && a.status === "confirmed"
  );

  return (
    <MainLayout>
      <div className="container py-8">
        {/* Profile Header */}
        <div className="mb-8">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <Avatar className="h-20 w-20 border-2 border-primary/20">
                <AvatarImage
                  src={doctorData?.profile_image_url || undefined}
                  alt={doctorProfile?.full_name}
                  className="object-cover"
                />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {doctorProfile?.full_name?.charAt(0) || "D"}
                </AvatarFallback>
              </Avatar>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploadingPhoto ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </button>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-heading text-3xl font-bold">
                  Dr. {doctorProfile?.full_name || "Doctor"}
                </h1>
                <Badge className="bg-success text-success-foreground">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1">
                {doctorData?.specialization} • ₹{doctorData?.consultation_fee} per consultation
              </p>
              {(doctorData?.state || doctorData?.location) && (
                <p className="mt-2 flex items-center text-sm text-muted-foreground gap-2"><MapPin className="h-4 w-4" />{doctorData?.state}{doctorData?.location ? ` • ${doctorData?.location}` : ''}</p>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.todayCount}</p>
                  <p className="text-sm text-muted-foreground">Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pendingCount}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                  <IndianRupee className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">₹{stats.totalEarnings}</p>
                  <p className="text-sm text-muted-foreground">Earnings</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-info/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalPatients}</p>
                  <p className="text-sm text-muted-foreground">Patients</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Today's Appointments */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Today's Appointments</CardTitle>
            <CardDescription>{format(new Date(), "EEEE, MMMM d, yyyy")}</CardDescription>
          </CardHeader>
          <CardContent>
            {todayAppointments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No appointments scheduled for today</p>
            ) : (
              <div className="space-y-4">
                {todayAppointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarFallback>{appt.patient?.full_name?.charAt(0) || "P"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{appt.patient?.full_name}</p>
                          {appt.patient?._id && (
                            <PatientHistoryModal
                              patientId={appt.patient._id}
                              patientName={appt.patient.full_name}
                            />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {appt.appointment_time.slice(0, 5)} • {appt.appointment_type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {appt.status === 'pending' && (
                        <>
                          <Button size="sm" onClick={() => handleUpdateStatus(appt._id, 'confirmed')} className="bg-success hover:bg-success/90">
                            Accept
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleUpdateStatus(appt._id, 'cancelled')}>
                            Reject
                          </Button>
                        </>
                      )}
                      {appt.status === 'confirmed' && (
                        <>
                          <PrescriptionModal
                            appointmentId={appt._id}
                            patientId={appt.patient_id}
                            patientName={appt.patient?.full_name || "Patient"}
                            doctorId={doctorData?._id || doctorData?.id || ""}
                            doctorName={doctorProfile?.full_name || "Doctor"}
                            doctorSpecialization={doctorData?.specialization || ""}
                            onSuccess={() => {
                              toast.success("Prescription sent to patient");
                            }}
                          />

                          {/* Chat controls: allow enabling/disabling chat from doctor dashboard */}
                          {!appt.chat_unlocked ? (
                            <Button size="sm" variant="secondary" onClick={async () => {
                              try {
                                await api.put(`/appointments/${appt._id}/permissions`, { chat_unlocked: true });
                                toast.success('Chat enabled for this appointment');
                                // refetch appointments
                                const { data } = await api.get('/appointments');
                                const mappedAppointments = data.map((appt: any) => ({
                                  ...appt,
                                  id: appt._id,
                                  patient: appt.patient_id ? {
                                    _id: appt.patient_id._id,
                                    full_name: appt.patient_id.full_name,
                                    email: appt.patient_id.email
                                  } : null
                                }));
                                setAppointments(mappedAppointments);
                              } catch (err) {
                                console.error('Error enabling chat', err);
                                toast.error('Failed to enable chat');
                              }
                            }}>Enable Chat</Button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" asChild>
                                <Link to={`/chat/${appt._id || appt.id}`}>
                                  <MessageSquare className="h-4 w-4 mr-1" />
                                  Chat
                                </Link>
                              </Button>
                              <Button size="sm" variant="destructive" onClick={async () => {
                                try {
                                  await api.put(`/appointments/${appt._id}/permissions`, { chat_unlocked: false });
                                  toast.success('Chat disabled for this appointment');
                                  // refetch appointments
                                  const { data } = await api.get('/appointments');
                                  const mappedAppointments = data.map((appt: any) => ({
                                    ...appt,
                                    id: appt._id,
                                    patient: appt.patient_id ? {
                                      _id: appt.patient_id._id,
                                      full_name: appt.patient_id.full_name,
                                      email: appt.patient_id.email
                                    } : null
                                  }));
                                  setAppointments(mappedAppointments);
                                } catch (err) {
                                  console.error('Error disabling chat', err);
                                  toast.error('Failed to disable chat');
                                }
                              }}>Disable Chat</Button>
                            </div>
                          )}

                          {appt.video_unlocked && appt.zoom_start_url && (
                            <Button size="sm" asChild>
                              <a href={appt.zoom_start_url} target="_blank" rel="noopener noreferrer">
                                <Video className="h-4 w-4 mr-1" />
                                Start Video
                              </a>
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Upcoming Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingAppointments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No upcoming appointments</p>
            ) : (
              <div className="space-y-4">
                {upcomingAppointments.slice(0, 5).map((appt) => (
                  <div
                    key={appt.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarFallback>{appt.patient?.full_name?.charAt(0) || "P"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{appt.patient?.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(appt.appointment_date), "MMM d")} at {appt.appointment_time.slice(0, 5)}
                        </p>
                      </div>
                    </div>
                    <Badge variant={appt.appointment_type === "emergency" ? "destructive" : "secondary"}>
                      {appt.appointment_type}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Availability Management */}
        {doctorData && <DoctorAvailability doctorId={doctorData._id || doctorData.id} />}
      </div>
    </MainLayout>
  );
}
