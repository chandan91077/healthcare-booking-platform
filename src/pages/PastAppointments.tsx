import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { getDoctorProfile, getProfile } from "@/lib/auth";
import api from "@/lib/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, isPast } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, Calendar, Search, MessageSquare, FileText, IndianRupee } from "lucide-react";
import { PrescriptionModal } from "@/components/PrescriptionModal";

interface DoctorData {
  _id: string;
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

export default function PastAppointments() {
  const { user, role, isLoading, isAuthenticated } = useAuthContext();
  const navigate = useNavigate();
  const [doctorData, setDoctorData] = useState<DoctorData | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    searchTerm: "",
    dateFrom: "",
    dateTo: "",
    status: "all",
    type: "all",
  });

  const fetchPastAppointments = async () => {
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
        } catch (error) {
          console.error("Error fetching appointments", error);
          toast.error("Failed to load past appointments");
        }
      }
      setLoading(false);
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
      fetchPastAppointments();
    }
  }, [user, isLoading, isAuthenticated, role]);

  const pastAppointments = appointments.filter(
    (a) => a.status === "completed" || (a.status === "confirmed" && isPast(new Date(a.appointment_date)))
  ).sort((a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime());

  const filteredPastAppointments = pastAppointments.filter((appt) => {
    const matchesSearch = !filters.searchTerm ||
      appt.patient?.full_name?.toLowerCase().includes(filters.searchTerm.toLowerCase());
    const matchesStatus = filters.status === "all" || appt.status === filters.status;
    const matchesType = filters.type === "all" || appt.appointment_type === filters.type;
    const matchesDateFrom = !filters.dateFrom || appt.appointment_date >= filters.dateFrom;
    const matchesDateTo = !filters.dateTo || appt.appointment_date <= filters.dateTo;
    return matchesSearch && matchesStatus && matchesType && matchesDateFrom && matchesDateTo;
  });

  if (isLoading || loading) {
    return (
      <MainLayout>
        <div className="container py-8">
          <Skeleton className="h-8 w-48 mb-8" />
          <Skeleton className="h-64" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container px-4 sm:px-6 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/doctor")}
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
            >
              <ArrowLeft className="h-3 sm:h-4 w-3 sm:w-4" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Calendar className="h-6 sm:h-8 w-6 sm:w-8 text-primary" />
            <div>
              <h1 className="font-heading text-xl sm:text-3xl font-bold">Past Appointments</h1>
              <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
                View and search your completed appointments
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-4 sm:mb-8">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Search className="h-4 sm:h-5 w-4 sm:w-5" />
              Search & Filter
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Find specific appointments using the filters below</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <Input
                placeholder="Search by patient name..."
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="h-9 text-sm"
              />
              <Input
                type="date"
                placeholder="From date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                className="h-9 text-sm"
              />
              <Input
                type="date"
                placeholder="To date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                className="h-9 text-sm"
              />
              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.type} onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Appointments List */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Appointment History</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {filteredPastAppointments.length} of {pastAppointments.length} appointments
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {filteredPastAppointments.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <Calendar className="h-12 sm:h-16 w-12 sm:w-16 text-muted-foreground mx-auto mb-3 sm:mb-4" />
                <p className="text-base sm:text-lg font-medium text-muted-foreground mb-2">
                  {pastAppointments.length === 0 ? "No past appointments" : "No appointments match your filters"}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {pastAppointments.length === 0
                    ? "Your completed appointments will appear here"
                    : "Try adjusting your search criteria"
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {filteredPastAppointments.map((appt) => (
                  <Card key={appt.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-6 bg-card border-b gap-3 sm:gap-0">
                        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                          <Avatar className="h-10 sm:h-12 w-10 sm:w-12 flex-shrink-0">
                            <AvatarFallback className="text-sm sm:text-lg">
                              {appt.patient?.full_name?.charAt(0) || "P"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className="font-semibold text-sm sm:text-lg truncate">{appt.patient?.full_name}</p>
                              <Badge variant={appt.appointment_type === "emergency" ? "destructive" : "secondary"} className="text-xs">
                                {appt.appointment_type}
                              </Badge>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:gap-4 gap-1 text-xs sm:text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 sm:h-4 w-3 sm:w-4" />
                                {format(new Date(appt.appointment_date), "MMM d, yyyy")} at {appt.appointment_time.slice(0, 5)}
                              </span>
                              <span className="flex items-center gap-1">
                                <IndianRupee className="h-3 sm:h-4 w-3 sm:w-4" />
                                {appt.amount}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <Badge
                            variant={appt.status === "completed" ? "default" : "destructive"}
                            className="px-2 sm:px-3 py-1 text-xs"
                          >
                            {appt.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 p-3 sm:p-4 bg-muted/30">
                        {/* Chat button */}
                        {appt.chat_unlocked ? (
                          <>
                            <Button size="sm" variant="outline" asChild className="text-xs sm:text-sm h-8 sm:h-9">
                              <Link to={`/chat/${appt._id || appt.id}`}>
                                <MessageSquare className="h-3 sm:h-4 w-3 sm:w-4 mr-1" />
                                Chat
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="text-xs sm:text-sm h-8 sm:h-9"
                              onClick={async () => {
                                try {
                                  await api.put(
                                    `/appointments/${appt._id || appt.id}/permissions`,
                                    { chat_unlocked: false }
                                  );
                                  toast.success("Chat disabled");
                                  // Refetch appointments
                                  const { data: appointmentsData } = await api.get("/appointments");
                                  const mappedAppointments = appointmentsData.map((a: any) => ({
                                    ...a,
                                    id: a._id,
                                    patient: a.patient_id
                                      ? {
                                          _id: a.patient_id._id,
                                          full_name: a.patient_id.full_name,
                                          email: a.patient_id.email,
                                        }
                                      : null,
                                  }));
                                  setAppointments(mappedAppointments);
                                } catch (err) {
                                  console.error("Error disabling chat", err);
                                  toast.error("Failed to disable chat");
                                }
                              }}
                            >
                              <span className="hidden sm:inline">Disable Chat</span>
                              <span className="sm:hidden">Disable</span>
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="text-xs sm:text-sm h-8 sm:h-9"
                            onClick={async () => {
                              try {
                                await api.put(
                                  `/appointments/${appt._id || appt.id}/permissions`,
                                  { chat_unlocked: true }
                                );
                                toast.success("Chat enabled");
                                // Refetch appointments
                                const { data: appointmentsData } = await api.get("/appointments");
                                const mappedAppointments = appointmentsData.map((a: any) => ({
                                  ...a,
                                  id: a._id,
                                  patient: a.patient_id
                                    ? {
                                        _id: a.patient_id._id,
                                        full_name: a.patient_id.full_name,
                                        email: a.patient_id.email,
                                      }
                                    : null,
                                }));
                                setAppointments(mappedAppointments);
                              } catch (err) {
                                console.error("Error enabling chat", err);
                                toast.error("Failed to enable chat");
                              }
                            }}
                          >
                            <span className="hidden sm:inline">Enable Chat</span>
                            <span className="sm:hidden">Enable</span>
                          </Button>
                        )}

                        {/* Prescribe button */}
                        <PrescriptionModal
                          appointmentId={appt._id}
                          patientId={appt.patient_id?._id || appt.patient_id}
                          patientName={appt.patient?.full_name || "Patient"}
                          doctorId={doctorData?._id || doctorData?.id}
                          doctorName={doctorProfile?.full_name || "Doctor"}
                          doctorSpecialization={doctorData?.specialization || "Physician"}
                        />

                        {/* View Details button */}
                        <Button size="sm" variant="ghost" asChild className="text-xs sm:text-sm h-8 sm:h-9">
                          <Link to={`/appointment/${appt.id}`}>
                            <FileText className="h-3 sm:h-4 w-3 sm:w-4 mr-1" />
                            <span className="hidden sm:inline">View Details</span>
                            <span className="sm:hidden">Details</span>
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}