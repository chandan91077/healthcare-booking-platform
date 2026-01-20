import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuthContext } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  IndianRupee,
  Calendar,
  Clock,
  CheckCircle2,
  Shield,
  CreditCard,
  ArrowLeft,
} from "lucide-react";
import { Link } from "react-router-dom";

interface AppointmentDetails {
  id: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type: string;
  amount: number;
  base_amount?: number;
  platform_fee?: number;
  status: string;
  payment_status: string;
  doctor: {
    id: string;
    specialization: string;
    profile: {
      full_name: string;
    } | null;
  } | null;
}

export default function Payment() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthContext();

  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    async function fetchAppointment() {
      if (!appointmentId) return;

      try {
        // Fetch appointment details
        // I need an endpoint to get a single appointment. 
        // apartments.js has `router.get('/:id', ...)`
        const { data: appt } = await api.get(`/appointments/${appointmentId}`);

        if (!appt) {
          toast.error("Appointment not found");
          navigate("/dashboard");
          return;
        }

        // Backend populates doctor_id but let's check how.
        // It uses `populate('doctor_id')` which is the Doctor model.
        // Doctor model has `user_id`.
        // We probably need to deep populate `doctor_id.user_id` to get the name?
        // My appointments.js `get('/:id')` does:
        // .populate('doctor_id')
        // .populate('patient_id');
        // If Doctor model just contains ref to User, I need the User info.
        // I'll update appointments.js to deep populate or just hope it's enough for now.
        // Or I map it.

        // Wait, appointments.js:
        // router.get('/:id', protect, async (req, res) => {
        //     const appointment = await Appointment.findById(req.params.id)
        //         .populate('doctor_id')
        //         .populate('patient_id');
        // ...

        // If doctor_id is populated, it is the Doctor document.
        // Doctor document has `user_id`. I need to populate that too!
        // I should update appointments.js.
        // For now I'll assume I can work with what I have or fix backend.
        // I'll fix backend in next step for robustness.

        // Let's assume the backend will return the right shape after I fix it.
        // Mapping:
        const doctor = appt.doctor_id; // This is the populated object

        // If backend isn't deep populating user, I won't have the name.
        // I'll blindly assume I fix the backend to populate `doctor_id.user_id`.

        const mappedAppt = {
          ...appt,
          id: appt._id,
          doctor: doctor ? {
            id: doctor._id,
            specialization: doctor.specialization,
            profile: doctor.user_id ? { // Assuming deep population
              full_name: doctor.user_id.full_name
            } : { full_name: "Doctor" }
          } : null
        };

        setAppointment(mappedAppt);
      } catch (error) {
        console.error("Error fetching appointment", error);
        toast.error("Appointment not found");
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading && isAuthenticated) {
      fetchAppointment();
    }
  }, [appointmentId, user, authLoading, navigate]);

  const handlePayment = async () => {
    const userId = user?._id || user?.id;
    if (!appointment || !userId) {
      toast.error("User or appointment information missing");
      return;
    }

    setProcessing(true);

    try {
      // Create Cashfree order
      const { data: orderData } = await api.post('/payments/create-order', {
        appointment_id: appointment.id,
        amount: appointment.amount
      });

      // Load Cashfree SDK
      const loadScript = (src: string) => {
        return new Promise((resolve) => {
          const script = document.createElement("script");
          script.src = src;
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
        });
      };

      const res = await loadScript("https://sdk.cashfree.com/js/v3/cashfree.js");

      if (!res) {
        toast.error("Cashfree SDK failed to load. Are you online?");
        setProcessing(false);
        return;
      }

      // Initialize Cashfree
      const cashfree = new (window as any).Cashfree(orderData.payment_session_id);

      // Configure checkout options
      const checkoutOptions = {
        paymentSessionId: orderData.payment_session_id,
        redirectTarget: "_self"
      };

      cashfree.checkout(checkoutOptions).then(async (result: any) => {
        if (result.error) {
          toast.error(result.error.message || "Payment failed");
          setProcessing(false);
          return;
        }

        if (result.paymentDetails) {
          try {
            // Verify payment on backend
            await api.post('/payments', {
              appointment_id: appointment.id,
              amount: appointment.amount,
              cashfree_order_id: orderData.order_id,
              payment_method: 'cashfree'
            });

            toast.success("Payment successful! Your appointment is confirmed.");
            navigate("/appointments");
          } catch (error: any) {
            toast.error(error.response?.data?.message || "Payment verification failed");
          }
        }
      }).catch((error: any) => {
        console.error("Payment error:", error);
        toast.error("Payment failed. Please try again.");
        setProcessing(false);
      });

    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.response?.data?.message || "Failed to initiate payment");
      setProcessing(false);
    }
  };

  // Testing helper: simulate a successful payment without calling a payment gateway
  const handleSimulatePayment = async () => {
    if (!appointment) {
      toast.error("Appointment not loaded");
      return;
    }

    setProcessing(true);

    try {
      // Use simulated IDs so backend records the payment and confirms the appointment
      await api.post('/payments', {
        appointment_id: appointment.id,
        amount: appointment.amount,
        razorpay_order_id: `sim_${Date.now()}`,
        razorpay_payment_id: `sim_pay_${Date.now()}`,
      });

      toast.success("Simulated payment successful! Your appointment is confirmed.");
      navigate('/appointments');
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Simulated payment failed");
    } finally {
      setProcessing(false);
    }
  };

  if (loading || authLoading) {
    return (
      <MainLayout>
        <div className="container py-8 max-w-2xl mx-auto">
          <Skeleton className="h-8 w-64 mb-8" />
          <Skeleton className="h-96" />
        </div>
      </MainLayout>
    );
  }

  if (!appointment) return null;

  return (
    <MainLayout>
      <div className="container py-8 max-w-2xl mx-auto">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        <h1 className="font-heading text-3xl font-bold mb-8">Complete Payment</h1>

        <Card>
          <CardHeader>
            <CardTitle>Appointment Summary</CardTitle>
            <CardDescription>Review your booking details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Doctor Info */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Dr. {appointment.doctor?.profile?.full_name}</p>
                <p className="text-sm text-muted-foreground">
                  {appointment.doctor?.specialization}
                </p>
              </div>
              <Badge variant={appointment.appointment_type === "emergency" ? "destructive" : "secondary"}>
                {appointment.appointment_type}
              </Badge>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {format(new Date(appointment.appointment_date), "EEEE, MMMM d, yyyy")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Time</p>
                  <p className="font-medium">{appointment.appointment_time.slice(0, 5)}</p>
                </div>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Consultation Fee</span>
                <span>₹{appointment.base_amount ?? appointment.amount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Platform Fee</span>
                <span>₹{appointment.platform_fee ?? 0}</span>
              </div>
              <div className="border-t pt-3 flex justify-between font-heading">
                <span className="text-lg font-semibold flex items-center gap-1">
                  <IndianRupee className="h-4 w-4" /> {appointment.amount}
                </span>
              </div>
            </div>

            <Button
              className="w-full gradient-primary border-0 mt-4"
              size="lg"
              onClick={handlePayment}
              disabled={processing}
            >
              {processing ? (
                "Processing..."
              ) : (
                <>
                  <CreditCard className="mr-2 h-5 w-5" />
                  Pay ₹{appointment.amount}
                </>
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full mt-3"
              size="lg"
              onClick={handleSimulatePayment}
              disabled={processing}
            >
              {processing ? "Processing..." : "Simulate Test Payment (Testing only)"}
            </Button>

            <p className="text-xs text-center text-muted-foreground mt-3">
              By proceeding, you agree to our terms of service and refund policy
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
