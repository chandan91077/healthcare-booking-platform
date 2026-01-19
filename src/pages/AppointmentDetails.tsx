import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import api from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Calendar,
  Clock,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  FileText,
  ArrowLeft,
  Download,
  Pill,
  Stethoscope,
} from "lucide-react";

interface Prescription {
  _id: string;
  diagnosis: string;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
  }>;
  instructions: string;
  doctor_notes: string;
  pdf_url: string | null;
  doctor_id: any;
  createdAt: string;
}

interface Appointment {
  _id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  amount: number;
  payment_status: string;
  notes: string;
  chat_unlocked: boolean;
  video_unlocked: boolean;
  video: {
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

export default function AppointmentDetails() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading, isAuthenticated } = useAuthContext();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    async function fetchAppointmentDetails() {
      if (!appointmentId) return;

      try {
        setLoading(true);
        // Fetch appointment details
        const { data: apptData } = await api.get(`/appointments/${appointmentId}`);
        
        if (!apptData) {
          toast.error("Appointment not found");
          navigate("/appointments");
          return;
        }

        // Map doctor data
        const appointmentWithMappedDoctor = {
          ...apptData,
          doctor: apptData.doctor_id ? {
            id: apptData.doctor_id._id,
            specialization: apptData.doctor_id.specialization,
            profile: { full_name: apptData.doctor_id.user_id?.full_name || "Unknown" }
          } : null,
          patient: apptData.patient_id ? {
            full_name: apptData.patient_id.full_name
          } : null
        };

        setAppointment(appointmentWithMappedDoctor);

        // Fetch prescriptions for this appointment
        try {
          const { data: prescData } = await api.get(`/prescriptions?appointment_id=${appointmentId}`);
          setPrescriptions(prescData || []);
        } catch (err) {
          console.error('Failed to fetch prescriptions', err);
          setPrescriptions([]);
        }
      } catch (err) {
        console.error('Error fetching appointment details', err);
        toast.error("Failed to load appointment details");
      } finally {
        setLoading(false);
      }
    }

    fetchAppointmentDetails();
  }, [appointmentId, navigate]);

  // Function to download prescription as image
  const downloadPrescriptionPDF = async (prescription: Prescription, prescriptionIndex: number) => {
    try {
      console.log('Starting download for prescription:', prescriptionIndex);
      
      const html2canvas = (await import("html2canvas")).default;
      console.log('html2canvas loaded');
      
      // Get the prescription element by index
      const element = document.getElementById(`prescription-${prescriptionIndex}`);
      console.log('Element found:', element);
      
      if (!element) {
        console.error('Element not found for index:', prescriptionIndex);
        toast.error("Could not find prescription content");
        return;
      }

      console.log('Generating canvas...');
      // Generate canvas from the element
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
      });
      
      console.log('Canvas generated:', canvas);

      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        console.log('Blob created:', blob);
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `prescription_${appointment?._id}_${format(new Date(prescription.createdAt), 'dd-MM-yyyy')}.jpg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          console.log('Download initiated');
          toast.success("Prescription downloaded successfully!");
        } else {
          console.error('Blob creation failed');
          console.error('Blob creation failed');
          toast.error("Failed to create image");
        }
      }, 'image/jpeg', 0.95);
    } catch (error) {
      console.error("Error generating prescription image:", error);
      toast.error(`Failed to download: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (loading || authLoading) {
    return (
      <MainLayout>
        <div className="container py-8 max-w-4xl">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!appointment) {
    return (
      <MainLayout>
        <div className="container py-8 max-w-4xl text-center">
          <h2 className="text-2xl font-bold mb-4">Appointment not found</h2>
          <Button asChild>
            <Link to="/appointments">Back to Appointments</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-emerald-100 text-emerald-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-emerald-100 text-emerald-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <MainLayout>
      <div className="container py-8 max-w-4xl">
        {/* Back button */}
        <Link
          to="/appointments"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Appointments
        </Link>

        {/* Doctor Information Card */}
        {appointment.doctor && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5" />
                Doctor Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                    {(appointment.doctor.profile?.full_name || 'D').charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">Dr. {appointment.doctor.profile?.full_name}</h3>
                  <p className="text-muted-foreground mb-3">{appointment.doctor.specialization}</p>
                  {appointment.notes && (
                    <div className="mt-2">
                      <p className="text-sm font-medium mb-1">Appointment Notes:</p>
                      <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                        {appointment.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Appointment Details Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Appointment Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Date</p>
                  <p className="text-lg font-semibold">{format(new Date(appointment.appointment_date), 'MMMM dd, yyyy')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Time</p>
                  <p className="text-lg font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {appointment.appointment_time}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                  <Badge className={getStatusColor(appointment.status)}>
                    {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                  </Badge>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Consultation Fee</p>
                  <p className="text-lg font-semibold flex items-center gap-1">
                    <IndianRupee className="h-5 w-5" />
                    {appointment.amount}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Payment Status</p>
                  <Badge className={getPaymentStatusColor(appointment.payment_status)}>
                    {appointment.payment_status.charAt(0).toUpperCase() + appointment.payment_status.slice(1)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Video Access</p>
                  <Badge variant={appointment.video?.enabled ? "default" : "secondary"}>
                    {appointment.video?.enabled ? "✓ Enabled" : "Not Available"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Communication Status */}
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm font-medium text-muted-foreground mb-3">Communication Options</p>
              <div className="flex gap-3">
                <Badge variant={appointment.chat_unlocked ? "default" : "secondary"}>
                  Chat: {appointment.chat_unlocked ? "✓ Enabled" : "Not Unlocked"}
                </Badge>
                <Badge variant={appointment.video?.enabled ? "default" : "secondary"}>
                  Video: {appointment.video?.enabled ? "✓ Enabled" : "Not Enabled"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Prescriptions Card */}
        {prescriptions.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5" />
                Prescriptions ({prescriptions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {prescriptions.map((prescription, index) => (
                  <div 
                    key={prescription._id} 
                    id={`prescription-${index}`}
                    className="pb-6 border-b last:border-b-0 last:pb-0 bg-white p-6 rounded-lg"
                  >
                    <div className="mb-4">
                      <h4 className="font-semibold text-lg mb-1">Prescription {index + 1}</h4>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(prescription.createdAt), 'MMM dd, yyyy')}
                      </p>
                      {prescription.doctor_id && (
                        <p className="text-sm font-medium text-primary mt-2">
                          Prescribed by: Dr. {typeof prescription.doctor_id === 'object' ? prescription.doctor_id.user_id?.full_name || 'Doctor' : 'Doctor'}
                        </p>
                      )}
                    </div>

                    {/* Diagnosis */}
                    {prescription.diagnosis && (
                      <div className="mb-4">
                        <p className="text-sm font-medium mb-1">Diagnosis</p>
                        <p className="text-sm bg-muted p-2 rounded">{prescription.diagnosis}</p>
                      </div>
                    )}

                    {/* Medications */}
                    {prescription.medications && prescription.medications.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-medium mb-3">Medications</p>
                        <div className="space-y-4">
                          {prescription.medications.map((med, idx) => (
                            <div key={idx} className="bg-muted rounded-lg p-4 border border-border">
                              <p className="font-semibold text-base mb-2">{med.name}</p>
                              <div className="grid grid-cols-3 gap-3 text-xs">
                                <div>
                                  <p className="text-muted-foreground font-medium mb-1">Dosage</p>
                                  <p className="text-foreground font-semibold">{med.dosage}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground font-medium mb-1">Frequency</p>
                                  <p className="text-foreground font-semibold">{med.frequency}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground font-medium mb-1">Duration</p>
                                  <p className="text-foreground font-semibold">{med.duration}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Instructions */}
                    {prescription.instructions && (
                      <div className="mb-4">
                        <p className="text-sm font-medium mb-1">Instructions</p>
                        <p className="text-sm bg-muted p-2 rounded">{prescription.instructions}</p>
                      </div>
                    )}

                    {/* Doctor Notes */}
                    {prescription.doctor_notes && (
                      <div className="mb-4">
                        <p className="text-sm font-medium mb-1">Doctor Notes</p>
                        <p className="text-sm bg-muted p-2 rounded">{prescription.doctor_notes}</p>
                      </div>
                    )}

                    {/* Download Button */}
                    <div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => downloadPrescriptionPDF(prescription, index)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download Prescription
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Prescriptions Message */}
        {prescriptions.length === 0 && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Pill className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-muted-foreground">No prescriptions yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Prescriptions will appear here after your appointment
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button asChild>
            <Link to="/appointments">Back to Appointments</Link>
          </Button>
          {appointment.status === 'confirmed' && (appointment.chat_unlocked || role === 'doctor') && (
            <Button variant="outline" asChild>
              <Link to={`/chat/${appointment._id}`}>Open Chat</Link>
            </Button>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
