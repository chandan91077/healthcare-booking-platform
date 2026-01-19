import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval } from "date-fns";
import {
  IndianRupee,
  Calendar,
  TrendingUp,
  Filter,
  Download,
  ArrowLeft,
} from "lucide-react";

interface Appointment {
  _id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  amount: number;
  payment_status: string;
  appointment_type: string;
  patient_id: {
    _id: string;
    full_name: string;
    email: string;
  };
  createdAt: string;
}

export default function DoctorEarnings() {
  const { user, role, isLoading, isAuthenticated } = useAuthContext();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>("current");

  const monthOptions = [
    { value: "current", label: format(new Date(), "MMMM yyyy") },
    { value: "last1", label: format(subMonths(new Date(), 1), "MMMM yyyy") },
    { value: "last2", label: format(subMonths(new Date(), 2), "MMMM yyyy") },
    { value: "last3", label: format(subMonths(new Date(), 3), "MMMM yyyy") },
    { value: "last4", label: format(subMonths(new Date(), 4), "MMMM yyyy") },
    { value: "last5", label: format(subMonths(new Date(), 5), "MMMM yyyy") },
    { value: "all", label: "All Time" },
  ];

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
      return;
    }
    if (!isLoading && role !== "doctor") {
      navigate("/dashboard");
      return;
    }
    if (!isLoading && role === "doctor") {
      fetchEarnings();
    }
  }, [isLoading, isAuthenticated, role]);

  useEffect(() => {
    filterAppointments();
  }, [selectedMonth, appointments]);

  const fetchEarnings = async () => {
    try {
      const { data: appointmentsData } = await api.get('/appointments');
      
      // Only include completed appointments with completed payments
      const paidAppointments = appointmentsData.filter(
        (appt: any) => 
          (appt.status === "completed" || appt.payment_status === "completed") &&
          appt.amount > 0
      );

      const mappedAppointments = paidAppointments.map((appt: any) => ({
        ...appt,
        patient_id: appt.patient_id ? {
          _id: appt.patient_id._id,
          full_name: appt.patient_id.full_name,
          email: appt.patient_id.email
        } : null
      }));

      setAppointments(mappedAppointments);
    } catch (error) {
      console.error("Error fetching earnings:", error);
      toast.error("Failed to load earnings data");
    } finally {
      setLoading(false);
    }
  };

  const filterAppointments = () => {
    if (selectedMonth === "all") {
      setFilteredAppointments(appointments);
      return;
    }

    let targetDate: Date;
    if (selectedMonth === "current") {
      targetDate = new Date();
    } else {
      const monthsAgo = parseInt(selectedMonth.replace("last", ""));
      targetDate = subMonths(new Date(), monthsAgo);
    }

    const monthStart = startOfMonth(targetDate);
    const monthEnd = endOfMonth(targetDate);

    const filtered = appointments.filter((appt) => {
      const apptDate = new Date(appt.appointment_date);
      return isWithinInterval(apptDate, { start: monthStart, end: monthEnd });
    });

    setFilteredAppointments(filtered);
  };

  const totalEarnings = filteredAppointments.reduce((sum, appt) => sum + (appt.amount || 0), 0);
  const totalAppointments = filteredAppointments.length;
  const averageEarning = totalAppointments > 0 ? totalEarnings / totalAppointments : 0;

  const handleExport = () => {
    // Create CSV content
    const headers = ["Date", "Patient", "Type", "Amount", "Status"];
    const rows = filteredAppointments.map(appt => [
      format(new Date(appt.appointment_date), "dd/MM/yyyy"),
      appt.patient_id?.full_name || "N/A",
      appt.appointment_type,
      `₹${appt.amount}`,
      appt.payment_status
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `earnings-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success("Earnings report exported successfully");
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="container px-4 sm:px-6 py-4 sm:py-8">
          <Skeleton className="h-6 sm:h-8 w-40 sm:w-48 mb-4 sm:mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <Skeleton className="h-28 sm:h-32" />
            <Skeleton className="h-28 sm:h-32" />
            <Skeleton className="h-28 sm:h-32" />
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container px-4 sm:px-6 py-4 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/doctor")} className="h-9 w-9 sm:h-10 sm:w-10">
              <ArrowLeft className="h-4 sm:h-5 w-4 sm:w-5" />
            </Button>
            <div>
              <h1 className="font-heading text-2xl sm:text-3xl font-bold">Earnings</h1>
              <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Track your consultation earnings</p>
            </div>
          </div>
          <Button onClick={handleExport} className="gap-2 text-xs sm:text-sm h-9 sm:h-10 w-full sm:w-auto">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export Report</span>
            <span className="sm:hidden">Export</span>
          </Button>
        </div>

        {/* Filter */}
        <Card className="mb-4 sm:mb-8">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <Filter className="h-4 sm:h-5 w-4 sm:w-5 text-muted-foreground flex-shrink-0" />
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-40 sm:w-64 text-sm">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-sm">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-10 sm:h-12 w-10 sm:w-12 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                  <IndianRupee className="h-5 sm:h-6 w-5 sm:w-6 text-success" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold truncate">₹{totalEarnings.toLocaleString()}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Earnings</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-10 sm:h-12 w-10 sm:w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-5 sm:h-6 w-5 sm:w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold truncate">{totalAppointments}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Consultations</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-10 sm:h-12 w-10 sm:w-12 rounded-full bg-info/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-5 sm:h-6 w-5 sm:w-6 text-info" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold truncate">₹{Math.round(averageEarning)}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Avg/Consultation</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Earnings List */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Transaction History</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {filteredAppointments.length} consultation{filteredAppointments.length !== 1 ? "s" : ""} in{" "}
              {monthOptions.find(o => o.value === selectedMonth)?.label}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {filteredAppointments.length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-muted-foreground">
                <IndianRupee className="h-10 sm:h-12 w-10 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                <p className="text-sm sm:text-base">No earnings found for the selected period</p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {filteredAppointments.map((appt) => (
                  <div
                    key={appt._id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border rounded-lg hover:bg-muted/50 transition-colors gap-3 sm:gap-0"
                  >
                    <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                      <Avatar className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
                        <AvatarFallback className="text-sm">
                          {appt.patient_id?.full_name?.charAt(0) || "P"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm sm:text-base truncate">{appt.patient_id?.full_name || "Unknown"}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">
                          {format(new Date(appt.appointment_date), "dd MMM yyyy")} • {appt.appointment_time}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4 justify-between sm:justify-end">
                      <Badge variant={appt.appointment_type === "emergency" ? "destructive" : "secondary"} className="text-xs">
                        {appt.appointment_type}
                      </Badge>
                      <div className="text-right min-w-[80px] sm:min-w-[100px]">
                        <p className="text-sm sm:text-lg font-semibold text-success">₹{appt.amount}</p>
                        <Badge variant="outline" className="text-xs">
                          {appt.payment_status}
                        </Badge>
                      </div>
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
