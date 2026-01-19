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
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/doctor")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="h-8 w-8 text-primary" />
            <div>
              <h1 className="font-heading text-3xl font-bold">Past Appointments</h1>
              <p className="text-muted-foreground mt-1">
                View and search your completed appointments
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search & Filter
            </CardTitle>
            <CardDescription>Find specific appointments using the filters below</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Input
                placeholder="Search by patient name..."
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
              />
              <Input
                type="date"
                placeholder="From date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              />
              <Input
                type="date"
                placeholder="To date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              />
              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.type} onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}>
                <SelectTrigger>
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
          <CardHeader>
            <CardTitle>Appointment History</CardTitle>
            <CardDescription>
              {filteredPastAppointments.length} of {pastAppointments.length} appointments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredPastAppointments.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-muted-foreground mb-2">
                  {pastAppointments.length === 0 ? "No past appointments" : "No appointments match your filters"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {pastAppointments.length === 0
                    ? "Your completed appointments will appear here"
                    : "Try adjusting your search criteria"
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPastAppointments.map((appt) => (
                  <Card key={appt.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex items-center justify-between p-6 bg-card border-b">
                        <div className="flex items-center gap-4 flex-1">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="text-lg">
                              {appt.patient?.full_name?.charAt(0) || "P"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-lg">{appt.patient?.full_name}</p>
                              <Badge variant={appt.appointment_type === "emergency" ? "destructive" : "secondary"}>
                                {appt.appointment_type}
                              </Badge>
                            </div>
                            <div className="flex gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {format(new Date(appt.appointment_date), "MMM d, yyyy")} at {appt.appointment_time.slice(0, 5)}
                              </span>
                              <span className="flex items-center gap-1">
                                <IndianRupee className="h-4 w-4" />
                                {appt.amount}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <Badge
                            variant={appt.status === "completed" ? "default" : "destructive"}
                            className="px-3 py-1"
                          >
                            {appt.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 p-4 bg-muted/30">
                        {/* Chat button */}
                        {appt.chat_unlocked ? (
                          <>
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`/chat/${appt._id || appt.id}`}>
                                <MessageSquare className="h-4 w-4 mr-1" />
                                Chat
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
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
                              Disable Chat
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
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
                            Enable Chat
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
                        <Button size="sm" variant="ghost" asChild>
                          <Link to={`/appointment/${appt.id}`}>
                            <FileText className="h-4 w-4 mr-1" />
                            View Details
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