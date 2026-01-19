import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { getDoctorProfile, getProfile } from "@/lib/auth";
import api from "@/lib/api";
import { uploadToS3 } from "@/lib/s3-upload";
import { MainLayout } from "@/components/layout/MainLayout";
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
  Users,
  TrendingUp,
  FileText,
  AlertTriangle,
  Camera,
  Loader2,
  MapPin,
  History,
} from "lucide-react";

interface DoctorData {
  _id: string;
  id: string;
  is_verified: boolean;
  verification_status: string;
  rejection_reason: string | null;
  rejection_history?: Array<{
    reason: string;
    date: Date | string;
    rejectedAt: string;
  }>;
  specialization: string;
  consultation_fee: number;
  emergency_fee: number;
  medical_license_url: string | null;
  profile_image_url: string | null;
  created_at?: string;
  createdAt?: string;
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
  video: {
    provider: string;
    meetingId: string;
    doctorJoinUrl: string;
    patientJoinUrl: string;
    enabled: boolean;
    enabledAt: string | null;
  };
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

          // Count all unique patients from all appointments, not just completed
          const uniquePatients = new Set(mappedAppointments.map((a: any) => a.patient?._id).filter(Boolean));
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
                    <p><strong>Submitted on:</strong> {doctorData.createdAt ? format(new Date(doctorData.createdAt), 'MMMM d, yyyy') : 'N/A'}</p>
                  </div>

                  <div className="bg-info/10 rounded-lg p-4 text-sm text-info">
                    Verification typically takes 1-2 business days. You will be notified once your account is verified.
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-destructive/10 rounded-lg p-4 text-sm text-destructive space-y-3">
                    <div>
                      <p className="font-semibold mb-2">Latest Reason for Rejection:</p>
                      <p>{doctorData.rejection_reason || "No reason provided"}</p>
                    </div>
                    
                    {doctorData.rejection_history && doctorData.rejection_history.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-destructive/20 space-y-2">
                        <p className="font-semibold text-xs">Rejection History ({doctorData.rejection_history.length}):</p>
                        {doctorData.rejection_history.map((rejection: any, idx: number) => (
                          <div key={idx} className="text-xs bg-destructive/5 rounded p-2 space-y-1">
                            <p className="text-destructive/90">{rejection.reason}</p>
                            <p className="text-destructive/70">
                              {new Date(rejection.rejectedAt || rejection.date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <Button variant="outline" className="mt-4" onClick={() => navigate("/doctor/register")}>
                      Resubmit Application
                    </Button>
                  </div>
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
      <div className="container px-4 sm:px-6 py-4 sm:py-6">
        {/* Profile Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-start sm:items-center gap-3 sm:gap-6">
            <div className="relative group flex-shrink-0">
              <Avatar className="h-14 sm:h-20 w-14 sm:w-20 border-2 border-primary/20">
                <AvatarImage
                  src={doctorData?.profile_image_url || undefined}
                  alt={doctorProfile?.full_name}
                  className="object-cover"
                />
                <AvatarFallback className="text-lg sm:text-2xl bg-primary/10 text-primary">
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
                  <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 text-white animate-spin" />
                ) : (
                  <Camera className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                )}
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-heading text-xl sm:text-3xl font-bold">
                  Dr. {doctorProfile?.full_name || "Doctor"}
                </h1>
                <Badge className="bg-success text-success-foreground text-xs sm:text-sm">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {doctorData?.specialization} • ₹{doctorData?.consultation_fee}/consultation
              </p>
              {(doctorData?.state || doctorData?.location) && (
                <p className="mt-1 sm:mt-2 flex items-center text-xs sm:text-sm text-muted-foreground gap-2"><MapPin className="h-3 sm:h-4 w-3 sm:w-4 flex-shrink-0" /><span className="truncate">{doctorData?.state}{doctorData?.location ? ` • ${doctorData?.location}` : ''}</span></p>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Card>
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="h-10 sm:h-12 w-10 sm:w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-5 sm:h-6 w-5 sm:w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold">{stats.todayCount}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="h-10 sm:h-12 w-10 sm:w-12 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-5 sm:h-6 w-5 sm:w-6 text-warning" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold">{stats.pendingCount}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/doctor/earnings")}>
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="h-10 sm:h-12 w-10 sm:w-12 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-5 sm:h-6 w-5 sm:w-6 text-success" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-success">View Details</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Earnings</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="h-10 sm:h-12 w-10 sm:w-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Users className="h-5 sm:h-6 w-5 sm:w-6 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold">{stats.totalPatients}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Patients</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Today's Appointments */}
        <Card className="mb-4 sm:mb-6">
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-lg sm:text-xl">Today's Appointments</CardTitle>
            <CardDescription className="text-xs sm:text-sm">{format(new Date(), "EEEE, MMMM d, yyyy")}</CardDescription>
          </CardHeader>
          <CardContent>
            {todayAppointments.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 sm:py-8 text-sm">No appointments scheduled for today</p>
            ) : (
              <div className="space-y-2 sm:space-y-4">
                {todayAppointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-3 sm:p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                      <Avatar className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
                        <AvatarFallback className="text-xs sm:text-sm">{appt.patient?.full_name?.charAt(0) || "P"}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-sm sm:text-base truncate">{appt.patient?.full_name}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {appt.appointment_time.slice(0, 5)} • {appt.appointment_type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                      {appt.status === 'pending' && (
                        <>
                          <Button size="sm" onClick={() => handleUpdateStatus(appt._id, 'confirmed')} className="bg-success hover:bg-success/90 text-xs sm:text-sm flex-1 sm:flex-none">
                            Accept
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleUpdateStatus(appt._id, 'cancelled')} className="text-xs sm:text-sm flex-1 sm:flex-none">
                            Reject
                          </Button>
                        </>
                      )}
                      {appt.status === 'confirmed' && (
                        <>
                          <Button size="sm" variant="outline" asChild className="text-xs sm:text-sm flex-1 sm:flex-none">
                            <Link to={`/chat/${appt._id || appt.id}`} className="flex items-center gap-1">
                              <MessageSquare className="h-3 sm:h-4 w-3 sm:w-4" />
                              Chat
                            </Link>
                          </Button>
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
        <Card className="mb-4 sm:mb-6">
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-lg sm:text-xl">Upcoming Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingAppointments.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 sm:py-8 text-sm">No upcoming appointments</p>
            ) : (
              <div className="space-y-2 sm:space-y-4">
                {upcomingAppointments.slice(0, 5).map((appt) => (
                  <div
                    key={appt.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-3 sm:p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                      <Avatar className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
                        <AvatarFallback className="text-xs sm:text-sm">{appt.patient?.full_name?.charAt(0) || "P"}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-sm sm:text-base truncate">{appt.patient?.full_name}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {format(new Date(appt.appointment_date), "MMM d")} at {appt.appointment_time.slice(0, 5)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                      <Badge variant={appt.appointment_type === "emergency" ? "destructive" : "secondary"} className="text-xs">
                        {appt.appointment_type}
                      </Badge>
                      {appt.status === 'confirmed' && (
                        <Button size="sm" variant="outline" asChild className="text-xs sm:text-sm">
                          <Link to={`/chat/${appt._id || appt.id}`}>
                            <MessageSquare className="h-3 sm:h-4 w-3 sm:w-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Past Appointments */}
        <Card className="mb-4 sm:mb-6">
          <CardHeader className="pb-3 sm:pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg sm:text-xl">Past Appointments</CardTitle>
                <CardDescription className="text-xs sm:text-sm">View and search your completed appointments</CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => navigate("/doctor/past-appointments")}
                className="text-xs sm:text-sm w-full sm:w-auto flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                View Past
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Availability Management */}
        {doctorData && <DoctorAvailability doctorId={doctorData._id || doctorData.id} />}
      </div>
    </MainLayout>
  );
}
