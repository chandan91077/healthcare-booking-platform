import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  ExternalLink,
  IndianRupee,
  AlertTriangle,
  Calendar,
  TrendingUp,
  Trash2,
  Download,
  Phone,
  Bell,
  Mail,
  Send,
} from "lucide-react";

interface DoctorApplication {
  id: string;
  user_id: string;
  specialization: string;
  experience_years: number;
  consultation_fee: number;
  emergency_fee: number;
  bio: string | null;
  medical_license_url: string | null;
  is_verified: boolean;
  verification_status: string;
  rejection_reason: string | null;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
    phone: string | null;
  } | null;
}

interface PaymentStats {
  totalRevenue: number;
  totalAppointments: number;
  completedPayments: number;
  pendingPayments: number;
}

interface DoctorEarningSummary {
  doctor_id: string;
  doctor_name: string;
  doctor_email: string | null;
  total_earnings: number;
  settled_earnings: number;
  unsettled_earnings: number;
  total_payments: number;
  unsettled_payments: number;
  normal_appointments: number;
  emergency_appointments: number;
}

interface AdminPaymentRecord {
  _id: string;
  amount: number;
  settled_amount?: number;
  last_settlement_amount?: number;
  settlement_status: "settled" | "unsettled";
  settlement_notes?: string;
  settled_at: string | null;
  createdAt: string;
  appointment_id?: {
    _id?: string;
    appointment_date?: string;
    appointment_time?: string;
    doctor_id?: {
      _id?: string;
      user_id?: {
        full_name?: string;
        email?: string;
      };
    };
    patient_id?: {
      _id?: string;
      full_name?: string;
      email?: string;
    };
  };
  patient_id?: {
    full_name?: string;
    email?: string;
  };
}

interface SettlementHistoryGroup {
  settlement_key: string;
  total_amount: number;
  settled_at: string | null;
  settlement_notes: string;
  settled_payments_count: number;
}

interface AdminBroadcastIssue {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  reason: string;
}

interface AdminBroadcastReport {
  recipients: number;
  in_app_sent: number;
  in_app_failed: AdminBroadcastIssue[];
  email_sent: number;
  email_failed: AdminBroadcastIssue[];
  email_skipped: AdminBroadcastIssue[];
}

export default function AdminDashboard() {
  const { user, role, isLoading, isAuthenticated } = useAuthContext();
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState<DoctorApplication[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorApplication | null>(null);
  const [doctorToApprove, setDoctorToApprove] = useState<DoctorApplication | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [doctorToDelete, setDoctorToDelete] = useState<DoctorApplication | null>(null);
  const [processing, setProcessing] = useState(false);
  const [settlingDoctorId, setSettlingDoctorId] = useState<string | null>(null);
  const [showSettleDialog, setShowSettleDialog] = useState(false);
  const [selectedEarning, setSelectedEarning] = useState<DoctorEarningSummary | null>(null);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyDoctor, setHistoryDoctor] = useState<DoctorEarningSummary | null>(null);
  const [settlementAmountInput, setSettlementAmountInput] = useState("");
  const [settlementNoteInput, setSettlementNoteInput] = useState("");
  const [doctorEarnings, setDoctorEarnings] = useState<DoctorEarningSummary[]>([]);
  const [adminPayments, setAdminPayments] = useState<AdminPaymentRecord[]>([]);
  const [settlementFrom, setSettlementFrom] = useState("");
  const [settlementTo, setSettlementTo] = useState("");
  const [settlementStatusFilter, setSettlementStatusFilter] = useState<"all" | "settled" | "unsettled">("all");
  const [platformFee, setPlatformFee] = useState(0);
  const [platformFeeInput, setPlatformFeeInput] = useState("0");
  const [savingPlatformFee, setSavingPlatformFee] = useState(false);
  const [updateTitle, setUpdateTitle] = useState("MediConnect Update");
  const [updateMessage, setUpdateMessage] = useState("");
  const [updateAudience, setUpdateAudience] = useState<"doctor" | "patient" | "both">("both");
  const [sendInAppUpdate, setSendInAppUpdate] = useState(true);
  const [sendEmailUpdate, setSendEmailUpdate] = useState(false);
  const [sendingAdminUpdate, setSendingAdminUpdate] = useState(false);
  const [lastBroadcastReport, setLastBroadcastReport] = useState<AdminBroadcastReport | null>(null);
  const [paymentStats, setPaymentStats] = useState<PaymentStats>({
    totalRevenue: 0,
    totalAppointments: 0,
    completedPayments: 0,
    pendingPayments: 0,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/adminpage");
      return;
    }
    if (!isLoading && role !== "admin") {
      navigate("/");
      return;
    }
  }, [isLoading, isAuthenticated, role, navigate]);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: doctorsData } = await api.get('/doctors/admin/all');

        const mappedDoctors = doctorsData.map((doc: any) => ({
          ...doc,
          id: doc._id,
          profiles: doc.user_id ? {
            full_name: doc.user_id.full_name,
            email: doc.user_id.email,
            phone: doc.user_id.phone
          } : null
        }));

        setDoctors(mappedDoctors as DoctorApplication[]);

        const { data: payments } = await api.get('/payments/admin/all');
        const { data: earningsData } = await api.get('/payments/admin/doctor-earnings');
        const { data: platformSettings } = await api.get('/platform-settings');

        setDoctorEarnings(earningsData || []);
        setAdminPayments((payments || []) as AdminPaymentRecord[]);
        const nextPlatformFee = Number(platformSettings?.platform_fee || 0);
        setPlatformFee(nextPlatformFee);
        setPlatformFeeInput(String(nextPlatformFee));

        const totalRevenue = (payments || []).reduce(
          (sum: number, payment: any) => sum + Number(payment.amount || 0),
          0
        );

        const pendingSettlementPayments = (payments || []).filter(
          (payment: any) => payment.settlement_status !== 'settled'
        ).length;

        setPaymentStats({
          totalRevenue,
          totalAppointments: payments?.length || 0,
          completedPayments: payments?.length || 0,
          pendingPayments: pendingSettlementPayments,
        });

      } catch (error) {
        toast.error("Failed to fetch data");
        console.error(error);
      } finally {
        setLoadingDoctors(false);
      }
    }

    if (!isLoading && isAuthenticated && role === "admin") {
      fetchData();
    }
  }, [isLoading, isAuthenticated, role]);

  const fetchEarningsOnly = async () => {
    const { data: earningsData } = await api.get('/payments/admin/doctor-earnings');
    const { data: payments } = await api.get('/payments/admin/all');

    setDoctorEarnings(earningsData || []);
    setAdminPayments((payments || []) as AdminPaymentRecord[]);
    const totalRevenue = (payments || []).reduce(
      (sum: number, payment: any) => sum + Number(payment.amount || 0),
      0
    );
    const pendingSettlementPayments = (payments || []).filter(
      (payment: any) => payment.settlement_status !== 'settled'
    ).length;

    setPaymentStats({
      totalRevenue,
      totalAppointments: payments?.length || 0,
      completedPayments: payments?.length || 0,
      pendingPayments: pendingSettlementPayments,
    });
  };

  const openSettleDialog = (doctor: DoctorEarningSummary) => {
    if (doctor.unsettled_payments === 0) {
      toast.info("No unsettled earnings for this doctor");
      return;
    }

    setSelectedEarning(doctor);
    setSettlementAmountInput(String(doctor.unsettled_earnings || ""));
    setSettlementNoteInput("");
    setShowSettleDialog(true);
  };

  const openHistoryDialog = (doctor: DoctorEarningSummary) => {
    setHistoryDoctor(doctor);
    setShowHistoryDialog(true);
  };

  const handleSettleDoctor = async () => {
    if (!selectedEarning) return;

    const requestedAmount = Number(settlementAmountInput);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      toast.error("Enter a valid settlement amount");
      return;
    }

    setSettlingDoctorId(selectedEarning.doctor_id);
    try {
      const { data } = await api.patch(`/payments/admin/settle-doctor/${selectedEarning.doctor_id}`, {
        settlement_amount: requestedAmount,
        notes: settlementNoteInput,
      });

      toast.success(
        `${selectedEarning.doctor_name} settled ₹${data?.settled_amount || 0}. Left ₹${data?.remaining_unsettled_amount || 0}`
      );
      setShowSettleDialog(false);
      setSelectedEarning(null);
      setSettlementAmountInput("");
      setSettlementNoteInput("");
      await fetchEarningsOnly();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to settle doctor earnings");
    } finally {
      setSettlingDoctorId(null);
    }
  };

  const handleApprove = async (doctor: DoctorApplication) => {
    setProcessing(true);
    try {
      await api.put(`/doctors/${doctor.id}`, {
        is_verified: true,
        verification_status: "verified",
        // verified_at: new Date(),
        // verified_by: user?.id,
      });

      // Send verification email (placeholder)
      console.log("Send verification email placeholder");

      setDoctors((prev) =>
        prev.map((d) =>
          d.id === doctor.id
            ? { ...d, is_verified: true, verification_status: "verified" }
            : d
        )
      );

      toast.success(`Dr. ${doctor.profiles?.full_name || "Unknown"} has been approved!`);
      return true;
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to approve doctor");
      return false;
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedDoctor) return;
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setProcessing(true);
    try {
      await api.put(`/doctors/${selectedDoctor.id}`, {
        verification_status: "rejected",
        rejection_reason: rejectReason,
      });

      // Send rejection email (placeholder)
      console.log("Send rejection email placeholder");

      setDoctors((prev) =>
        prev.map((d) =>
          d.id === selectedDoctor.id
            ? { ...d, verification_status: "rejected", rejection_reason: rejectReason }
            : d
        )
      );

      toast.success("Doctor application rejected");
      setShowRejectDialog(false);
      setSelectedDoctor(null);
      setRejectReason("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to reject doctor");
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!doctorToDelete) return;

    setProcessing(true);
    try {
      await api.delete(`/doctors/${doctorToDelete.id}`);

      setDoctors((prev) => prev.filter((d) => d.id !== doctorToDelete.id));
      toast.success(`Dr. ${doctorToDelete.profiles?.full_name || "Unknown"} has been removed from the platform`);
      setShowDeleteDialog(false);
      setDoctorToDelete(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete doctor");
    } finally {
      setProcessing(false);
    }
  };

  const handleSavePlatformFee = async () => {
    const nextFee = Number(platformFeeInput);
    if (!Number.isFinite(nextFee) || nextFee < 0) {
      toast.error("Enter a valid non-negative platform fee");
      return;
    }

    setSavingPlatformFee(true);
    try {
      const { data } = await api.patch('/platform-settings', {
        platform_fee: Number(nextFee.toFixed(2)),
      });

      const savedFee = Number(data?.platform_fee || 0);
      setPlatformFee(savedFee);
      setPlatformFeeInput(String(savedFee));
      toast.success(`Platform fee updated to ₹${savedFee}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update platform fee");
    } finally {
      setSavingPlatformFee(false);
    }
  };

  const handleSendAdminUpdate = async () => {
    const title = updateTitle.trim() || "MediConnect Update";
    const message = updateMessage.trim();

    if (!message) {
      toast.error("Please enter update message");
      return;
    }

    const channels = [
      ...(sendInAppUpdate ? ["in_app"] : []),
      ...(sendEmailUpdate ? ["email"] : []),
    ];

    if (channels.length === 0) {
      toast.error("Select at least one delivery option");
      return;
    }

    setSendingAdminUpdate(true);
    try {
      const { data } = await api.post('/notifications/admin/broadcast', {
        title,
        message,
        audience: updateAudience,
        channels,
      });

      const recipients = Number(data?.recipients || 0);
      const inAppSent = Number(data?.in_app_sent || 0);
      const emailSent = Number(data?.email_sent || 0);
      const report: AdminBroadcastReport = {
        recipients,
        in_app_sent: inAppSent,
        in_app_failed: Array.isArray(data?.in_app_failed) ? data.in_app_failed : [],
        email_sent: emailSent,
        email_failed: Array.isArray(data?.email_failed) ? data.email_failed : [],
        email_skipped: Array.isArray(data?.email_skipped) ? data.email_skipped : [],
      };

      setLastBroadcastReport(report);

      const totalIssues =
        report.in_app_failed.length +
        report.email_failed.length +
        report.email_skipped.length;

      if (totalIssues > 0) {
        toast.warning(
          `Update sent with delivery issues. In-app sent: ${inAppSent}, Email sent: ${emailSent}, Issues: ${totalIssues}`
        );
      } else {
        toast.success(
          `Update sent. Recipients: ${recipients}, In-app: ${inAppSent}, Email sent: ${emailSent}`
        );
      }
      setUpdateMessage("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to send admin update");
    } finally {
      setSendingAdminUpdate(false);
    }
  };

  const pendingDoctors = doctors.filter((d) => d.verification_status === "pending");
  const approvedDoctors = doctors.filter(
    (d) => d.verification_status === "approved" || d.verification_status === "verified"
  );
  const rejectedDoctors = doctors.filter((d) => d.verification_status === "rejected");

  const getPaymentFilterDate = (payment: AdminPaymentRecord) => {
    const sourceDate = payment.settled_at || payment.createdAt;
    if (!sourceDate) return "";
    const parsed = new Date(sourceDate);
    if (Number.isNaN(parsed.getTime())) return "";
    return format(parsed, "yyyy-MM-dd");
  };

  const filteredSettlementPayments = adminPayments.filter((payment) => {
    if (settlementStatusFilter !== "all" && payment.settlement_status !== settlementStatusFilter) {
      return false;
    }

    const paymentDate = getPaymentFilterDate(payment);

    if (settlementFrom && paymentDate && paymentDate < settlementFrom) {
      return false;
    }

    if (settlementTo && paymentDate && paymentDate > settlementTo) {
      return false;
    }

    return true;
  });

  const exportSettlementCsv = () => {
    if (filteredSettlementPayments.length === 0) {
      toast.info("No settlement records to export");
      return;
    }

    const headers = [
      "payment_id",
      "doctor_name",
      "patient_name",
      "appointment_date",
      "appointment_time",
      "amount",
      "settlement_status",
      "settlement_notes",
      "settled_at",
      "created_at",
    ];

    const rows = filteredSettlementPayments.map((payment) => {
      const doctorName = payment.appointment_id?.doctor_id?.user_id?.full_name || "Doctor";
      const patientName =
        payment.appointment_id?.patient_id?.full_name || payment.patient_id?.full_name || "Patient";

      return [
        payment._id,
        doctorName,
        patientName,
        payment.appointment_id?.appointment_date || "",
        payment.appointment_id?.appointment_time || "",
        String(payment.amount || 0),
        payment.settlement_status || "unsettled",
        payment.settlement_notes || "",
        payment.settled_at || "",
        payment.createdAt || "",
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `settlements_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const doctorSettlementHistory: SettlementHistoryGroup[] = historyDoctor
    ? (() => {
      const grouped = new Map<string, SettlementHistoryGroup>();

      adminPayments
        .filter((payment) => {
          const doctorId = payment.appointment_id?.doctor_id?._id;
          return (
            doctorId &&
            doctorId.toString() === historyDoctor.doctor_id.toString() &&
            Boolean(payment.settled_at) &&
            Number(payment.last_settlement_amount || payment.settled_amount || 0) > 0
          );
        })
        .forEach((payment) => {
          const settledAt = payment.settled_at || null;
          const note = (payment.settlement_notes || "").trim();
          const key = `${settledAt || "unknown"}__${note}`;

          if (!grouped.has(key)) {
            grouped.set(key, {
              settlement_key: key,
              total_amount: 0,
              settled_at: settledAt,
              settlement_notes: note,
              settled_payments_count: 0,
            });
          }

          const item = grouped.get(key)!;
          item.total_amount += Number(payment.last_settlement_amount || payment.settled_amount || payment.amount || 0);
          item.settled_payments_count += 1;
        });

      return Array.from(grouped.values()).sort((a, b) => {
        const aTime = new Date(a.settled_at || 0).getTime();
        const bTime = new Date(b.settled_at || 0).getTime();
        return bTime - aTime;
      });
    })()
    : [];

  if (isLoading || loadingDoctors) {
    return (
      <MainLayout>
        <div className="container py-8">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </MainLayout>
    );
  }

  const DoctorCard = ({ doctor }: { doctor: DoctorApplication }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary/10 text-primary">
              {doctor.profiles?.full_name?.charAt(0) || "D"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="font-semibold truncate">
                {doctor.profiles?.full_name || "Unknown Doctor"}
              </h3>
              <Badge
                variant={
                  doctor.verification_status === "approved"
                    ? "default"
                    : doctor.verification_status === "rejected"
                      ? "destructive"
                      : "secondary"
                }
              >
                {doctor.verification_status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {doctor.profiles?.email}
            </p>
            <div className="mt-2 text-sm text-muted-foreground">
              {doctor.profiles?.phone ? (
                <a
                  href={`tel:${doctor.profiles.phone}`}
                  className="inline-flex items-center gap-1 hover:text-primary"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {doctor.profiles.phone}
                </a>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  Phone not provided
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant="outline">{doctor.specialization}</Badge>
              <Badge variant="outline">{doctor.experience_years} years exp.</Badge>
            </div>
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              <span>₹{doctor.consultation_fee} / consult</span>
              <span>₹{doctor.emergency_fee} / emergency</span>
            </div>
            {doctor.medical_license_url && (
              <Button variant="link" size="sm" className="p-0 h-auto mt-2" asChild>
                <a href={doctor.medical_license_url} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-3 w-3 mr-1" />
                  View License
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            )}
            {doctor.verification_status === "pending" && (
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  onClick={() => {
                    setDoctorToApprove(doctor);
                    setShowApproveDialog(true);
                  }}
                  disabled={processing}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setSelectedDoctor(doctor);
                    setShowRejectDialog(true);
                  }}
                  disabled={processing}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </div>
            )}
            {doctor.verification_status === "approved" && (
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    setDoctorToDelete(doctor);
                    setShowDeleteDialog(true);
                  }}
                  disabled={processing}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remove Doctor
                </Button>
              </div>
            )}
            {doctor.verification_status === "rejected" && (
              <div className="mt-3 space-y-2">
                {doctor.rejection_reason && (
                  <div className="p-2 bg-destructive/10 rounded text-sm">
                    <strong>Reason:</strong> {doctor.rejection_reason}
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    setDoctorToDelete(doctor);
                    setShowDeleteDialog(true);
                  }}
                  disabled={processing}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <MainLayout>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage doctor verifications and platform overview
          </p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingDoctors.length}</p>
                  <p className="text-sm text-muted-foreground">Pending Doctors</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{approvedDoctors.length}</p>
                  <p className="text-sm text-muted-foreground">Verified Doctors</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{paymentStats.totalAppointments}</p>
                  <p className="text-sm text-muted-foreground">Completed Payments</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-info/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold">₹{paymentStats.totalRevenue}</p>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Doctor Management Tabs */}
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              Pending ({pendingDoctors.length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Approved ({approvedDoctors.length})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2">
              <XCircle className="h-4 w-4" />
              Rejected ({rejectedDoctors.length})
            </TabsTrigger>
            <TabsTrigger value="settlements" className="gap-2">
              <IndianRupee className="h-4 w-4" />
              Settlements
            </TabsTrigger>
            <TabsTrigger value="platform-fee" className="gap-2">
              <IndianRupee className="h-4 w-4" />
              Platform Fee
            </TabsTrigger>
            <TabsTrigger value="updates" className="gap-2">
              <Bell className="h-4 w-4" />
              Updates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            {pendingDoctors.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending doctor applications</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {pendingDoctors.map((doctor) => (
                  <DoctorCard key={doctor.id} doctor={doctor} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="approved" className="mt-6">
            {approvedDoctors.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No approved doctors yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {approvedDoctors.map((doctor) => (
                  <DoctorCard key={doctor.id} doctor={doctor} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rejected" className="mt-6">
            {rejectedDoctors.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <XCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No rejected applications</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {rejectedDoctors.map((doctor) => (
                  <DoctorCard key={doctor.id} doctor={doctor} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="settlements" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Doctor Earnings Settlement</CardTitle>
                <CardDescription>Manual settlements by admin</CardDescription>
              </CardHeader>
              <CardContent>
                {doctorEarnings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No doctor earnings found yet.</p>
                ) : (
                  <div className="space-y-3">
                    {doctorEarnings.map((earning) => (
                      <div
                        key={earning.doctor_id}
                        className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 border rounded-lg"
                      >
                        <div>
                          <p className="font-semibold">{earning.doctor_name}</p>
                          <p className="text-sm text-muted-foreground">{earning.doctor_email || "No email"}</p>
                          <div className="flex flex-wrap gap-2 mt-2 text-xs">
                            <Badge variant="outline">Total: ₹{earning.total_earnings}</Badge>
                            <Badge variant="outline">Settled: ₹{earning.settled_earnings}</Badge>
                            <Badge variant={earning.unsettled_earnings > 0 ? "destructive" : "secondary"}>
                              Unsettled: ₹{earning.unsettled_earnings}
                            </Badge>
                            <Badge variant="outline">Normal: {earning.normal_appointments || 0}</Badge>
                            <Badge variant="outline">Emergency: {earning.emergency_appointments || 0}</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            onClick={() => openHistoryDialog(earning)}
                          >
                            History
                          </Button>
                          <Button
                            onClick={() => openSettleDialog(earning)}
                            disabled={earning.unsettled_payments === 0 || settlingDoctorId === earning.doctor_id}
                          >
                            {settlingDoctorId === earning.doctor_id ? "Settling..." : "Settle Earnings"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Settlement Ledger</CardTitle>
                <CardDescription>Filter by date and export records for accounting</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-3 mb-4">
                  <input
                    type="date"
                    value={settlementFrom}
                    onChange={(e) => setSettlementFrom(e.target.value)}
                    className="border rounded-md px-3 py-2 text-sm"
                  />
                  <input
                    type="date"
                    value={settlementTo}
                    onChange={(e) => setSettlementTo(e.target.value)}
                    className="border rounded-md px-3 py-2 text-sm"
                  />
                  <select
                    value={settlementStatusFilter}
                    onChange={(e) => setSettlementStatusFilter(e.target.value as "all" | "settled" | "unsettled")}
                    className="border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="settled">Settled</option>
                    <option value="unsettled">Unsettled</option>
                  </select>
                  <Button variant="outline" onClick={exportSettlementCsv}>
                    <Download className="h-4 w-4 mr-1" />
                    Export CSV
                  </Button>
                </div>

                {filteredSettlementPayments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments found for selected filters.</p>
                ) : (
                  <div className="space-y-2">
                    {filteredSettlementPayments.map((payment) => {
                      const doctorName = payment.appointment_id?.doctor_id?.user_id?.full_name || "Doctor";
                      const patientName =
                        payment.appointment_id?.patient_id?.full_name || payment.patient_id?.full_name || "Patient";

                      return (
                        <div key={payment._id} className="border rounded-md p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                          <div>
                            <p className="font-medium">{doctorName} • {patientName}</p>
                            <p className="text-xs text-muted-foreground">
                              Appointment: {payment.appointment_id?.appointment_date || "-"} {payment.appointment_id?.appointment_time || ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Created: {payment.createdAt ? format(new Date(payment.createdAt), "MMM d, yyyy") : "-"}
                              {payment.settled_at ? ` • Settled: ${format(new Date(payment.settled_at), "MMM d, yyyy")}` : ""}
                            </p>
                            {payment.settlement_notes ? (
                              <p className="text-xs text-muted-foreground">Note: {payment.settlement_notes}</p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">₹{payment.amount || 0}</Badge>
                            <Badge variant={payment.settlement_status === "settled" ? "secondary" : "destructive"}>
                              {payment.settlement_status}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="platform-fee" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Platform Fee Settings</CardTitle>
                <CardDescription>
                  Set the fixed platform fee added to every patient checkout.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-full max-w-xs">
                    <label className="text-sm font-medium">Platform Fee (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={platformFeeInput}
                      onChange={(e) => setPlatformFeeInput(e.target.value)}
                      className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                      placeholder="Enter platform fee"
                    />
                  </div>
                  <Button className="mt-6" onClick={handleSavePlatformFee} disabled={savingPlatformFee}>
                    {savingPlatformFee ? "Saving..." : "Save Fee"}
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground">
                  Current platform fee: ₹{platformFee}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="updates" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Send App Update</CardTitle>
                <CardDescription>
                  Send information to doctors, patients, or both via app notification and/or email.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <input
                    type="text"
                    value={updateTitle}
                    onChange={(e) => setUpdateTitle(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    placeholder="Enter update title"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Message</label>
                  <Textarea
                    value={updateMessage}
                    onChange={(e) => setUpdateMessage(e.target.value)}
                    placeholder="Write the update you want to share"
                    rows={5}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Send To</label>
                  <select
                    value={updateAudience}
                    onChange={(e) => setUpdateAudience(e.target.value as "doctor" | "patient" | "both")}
                    className="w-full max-w-xs border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="doctor">Only Doctors</option>
                    <option value="patient">Only Patients</option>
                    <option value="both">Doctors and Patients</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Delivery Method</label>
                  <div className="flex flex-wrap gap-4">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={sendInAppUpdate}
                        onChange={(e) => setSendInAppUpdate(e.target.checked)}
                      />
                      <Bell className="h-4 w-4" />
                      In-App Notification
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={sendEmailUpdate}
                        onChange={(e) => setSendEmailUpdate(e.target.checked)}
                      />
                      <Mail className="h-4 w-4" />
                      Email
                    </label>
                  </div>
                </div>

                <div>
                  <Button onClick={handleSendAdminUpdate} disabled={sendingAdminUpdate}>
                    <Send className="h-4 w-4 mr-2" />
                    {sendingAdminUpdate ? "Sending..." : "Send Update"}
                  </Button>
                </div>

                {lastBroadcastReport && (
                  <div className="space-y-4 rounded-md border p-4">
                    <div>
                      <p className="font-medium">Delivery Report</p>
                      <p className="text-sm text-muted-foreground">
                        Recipients: {lastBroadcastReport.recipients} • In-app sent: {lastBroadcastReport.in_app_sent} • Email sent: {lastBroadcastReport.email_sent}
                      </p>
                    </div>

                    {lastBroadcastReport.email_failed.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-destructive">Email failed</p>
                        <div className="mt-2 space-y-2">
                          {lastBroadcastReport.email_failed.map((item) => (
                            <div key={`email-failed-${item.user_id}-${item.email}`} className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                              <p><strong>{item.full_name || "Unknown user"}</strong> ({item.role || "user"})</p>
                              <p>Email: {item.email || "No email"}</p>
                              <p>Reason: {item.reason}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {lastBroadcastReport.email_skipped.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-orange-600">Email skipped</p>
                        <div className="mt-2 space-y-2">
                          {lastBroadcastReport.email_skipped.map((item) => (
                            <div key={`email-skipped-${item.user_id}`} className="rounded-md border border-orange-300 bg-orange-50 p-3 text-sm">
                              <p><strong>{item.full_name || "Unknown user"}</strong> ({item.role || "user"})</p>
                              <p>User ID: {item.user_id || "N/A"}</p>
                              <p>Reason: {item.reason}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {lastBroadcastReport.in_app_failed.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-destructive">App notification failed</p>
                        <div className="mt-2 space-y-2">
                          {lastBroadcastReport.in_app_failed.map((item) => (
                            <div key={`in-app-failed-${item.user_id}`} className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                              <p><strong>{item.full_name || "Unknown user"}</strong> ({item.role || "user"})</p>
                              <p>User ID: {item.user_id || "N/A"}</p>
                              <p>Email: {item.email || "No email"}</p>
                              <p>Reason: {item.reason}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Approve Confirmation Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Doctor Application</DialogTitle>
            <DialogDescription>
              Confirm approval for Dr. {doctorToApprove?.profiles?.full_name || "this doctor"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm">
            <p><strong>Email:</strong> {doctorToApprove?.profiles?.email || "Not provided"}</p>
            <p><strong>Phone:</strong> {doctorToApprove?.profiles?.phone || "Not provided"}</p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowApproveDialog(false);
                setDoctorToApprove(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!doctorToApprove) return;
                const approved = await handleApprove(doctorToApprove);
                if (approved) {
                  setShowApproveDialog(false);
                  setDoctorToApprove(null);
                }
              }}
              disabled={processing || !doctorToApprove}
            >
              {processing ? "Approving..." : "Confirm Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Doctor Application</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this application. This will be shown to the doctor.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter reason for rejection..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing}>
              Reject Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Doctor from Platform</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove Dr. {doctorToDelete?.profiles?.full_name || "this doctor"} from the platform?
              This action cannot be undone and will delete all their data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={processing}>
              <Trash2 className="h-4 w-4 mr-1" />
              Remove Doctor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSettleDialog} onOpenChange={setShowSettleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settle Doctor Earnings</DialogTitle>
            <DialogDescription>
              {selectedEarning?.doctor_name || "Doctor"} • Unsettled ₹{selectedEarning?.unsettled_earnings || 0}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Settlement Amount</label>
              <input
                type="number"
                min="1"
                step="1"
                value={settlementAmountInput}
                onChange={(e) => setSettlementAmountInput(e.target.value)}
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                placeholder="Enter amount paid"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Admin Note</label>
              <Textarea
                value={settlementNoteInput}
                onChange={(e) => setSettlementNoteInput(e.target.value)}
                placeholder="Add note for this manual settlement"
                className="min-h-[90px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSettleDialog(false);
                setSelectedEarning(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSettleDoctor}
              disabled={!selectedEarning || settlingDoctorId === selectedEarning.doctor_id}
            >
              {selectedEarning && settlingDoctorId === selectedEarning.doctor_id ? "Settling..." : "Confirm Settlement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settlement History</DialogTitle>
            <DialogDescription>
              {historyDoctor?.doctor_name || "Doctor"} settlement notes
            </DialogDescription>
          </DialogHeader>

          {doctorSettlementHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No settled records found.</p>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto">
              {doctorSettlementHistory.map((settlement) => (
                <div key={settlement.settlement_key} className="border rounded-md p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium">₹{settlement.total_amount || 0}</p>
                    <p className="text-xs text-muted-foreground">
                      {settlement.settled_at ? format(new Date(settlement.settled_at), "MMM d, yyyy") : "-"}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Settled payments: {settlement.settled_payments_count}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Admin Note:</span> {settlement.settlement_notes || "No note provided"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
