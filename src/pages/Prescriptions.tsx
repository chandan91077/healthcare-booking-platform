import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import api from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  FileText,
  Download,
  Calendar,
  User,
  Pill,
  Stethoscope,
} from "lucide-react";

interface Prescription {
  _id: string;
  diagnosis: string;
  medications: any;
  instructions: string | null;
  doctor_notes: string | null;
  pdf_url: string | null;
  createdAt: string;
  appointment_id: {
    appointment_date: string;
    _id: string;
  } | null;
  doctor_id: {
    specialization: string;
    user_id: {
      full_name: string;
    } | null;
  } | null;
  patient_id: {
    _id: string;
    full_name: string;
  } | null;
}

export default function Prescriptions() {
  const { user, role, isLoading: authLoading, isAuthenticated } = useAuthContext();
  const navigate = useNavigate();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    async function fetchPrescriptions() {
      if (!user?._id && !user?.id) return;

      try {
        const { data } = await api.get('/prescriptions');
        setPrescriptions(data);
      } catch (error) {
        console.error("Error fetching prescriptions:", error);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading && (user?._id || user?.id)) {
      fetchPrescriptions();
    }
  }, [user, role, authLoading]);

  if (loading || authLoading) {
    return (
      <MainLayout>
        <div className="container py-8">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="grid md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="font-heading text-3xl font-bold mb-2">
              {role === 'doctor' ? 'History of Issued Prescriptions' : 'My Prescriptions'}
            </h1>
            <p className="text-muted-foreground">
              {role === 'doctor'
                ? 'Review and manage all prescriptions you have provided to patients'
                : 'View and download your digital medical prescriptions'
              }
            </p>
          </div>
          {role === 'doctor' && (
            <Button variant="outline" asChild>
              <Link to="/appointments">Issue New Prescription</Link>
            </Button>
          )}
        </div>

        {prescriptions.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="font-heading text-xl font-semibold mb-2">
                No Prescriptions Found
              </h3>
              <p className="text-muted-foreground mb-4">
                {role === 'doctor'
                  ? "You haven't issued any prescriptions yet"
                  : "Prescriptions from your consultations will appear here"
                }
              </p>
              {role === 'patient' && (
                <Button asChild>
                  <Link to="/doctors">Book a Consultation</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {prescriptions.map((prescription) => (
              <Card key={prescription._id} className="hover:shadow-md transition-shadow border-primary/10">
                <CardHeader className="pb-3 border-b bg-muted/20">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2 text-primary">
                        <Stethoscope className="h-5 w-5" />
                        {prescription.diagnosis}
                      </CardTitle>
                      <CardDescription className="flex flex-col gap-1">
                        <span className="font-medium text-foreground">
                          {role === 'doctor'
                            ? `Patient: ${prescription.patient_id?.full_name || 'Unknown'}`
                            : `Dr. ${prescription.doctor_id?.user_id?.full_name || 'Unknown'}`
                          }
                        </span>
                        <span className="text-xs">
                          {prescription.doctor_id?.specialization}
                        </span>
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="font-normal">
                      {format(new Date(prescription.createdAt), "MMM d, yyyy")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 pt-4">
                  {/* Medications */}
                  <div className="bg-primary/5 p-3 rounded-lg border border-primary/10">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-2">
                      <Pill className="h-3 w-3" />
                      Medications
                    </h4>
                    <div className="space-y-1.5">
                      {Array.isArray(prescription.medications) && prescription.medications.length > 0 ? (
                        prescription.medications.map((med: any, index: number) => (
                          <div key={index} className="text-sm border-b border-primary/5 pb-1.5 last:border-0 last:pb-0">
                            <div className="flex justify-between items-start">
                              <span className="font-semibold">{med.name}</span>
                              <span className="text-[10px] bg-primary/10 px-1.5 py-0.5 rounded text-primary">{med.duration}</span>
                            </div>
                            <div className="text-xs text-muted-foreground flex gap-2 mt-0.5">
                              <span>{med.dosage}</span>
                              <span>• {med.frequency}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No medications listed</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {/* Instructions */}
                    {prescription.instructions && (
                      <div className="text-sm">
                        <h4 className="font-semibold mb-1 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          Patient Instructions
                        </h4>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          {prescription.instructions}
                        </p>
                      </div>
                    )}

                    {/* Clinical Notes (Only if exists) */}
                    {prescription.doctor_notes && (
                      <div className="text-sm border-t pt-3">
                        <h4 className="font-semibold mb-1 flex items-center gap-2">
                          <Stethoscope className="h-4 w-4 text-muted-foreground" />
                          Clinical Notes
                        </h4>
                        <div className="text-muted-foreground text-xs leading-relaxed max-h-[100px] overflow-y-auto pr-2 scrollbar-thin">
                          {prescription.doctor_notes}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between items-center pt-2 border-t mt-auto">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Ref: {prescription.appointment_id?._id?.slice(-8).toUpperCase() || 'N/A'}
                    </div>
                    <div className="flex gap-2">
                      {prescription.pdf_url && (
                        <Button size="sm" variant="default" className="h-8 gap-1.5" asChild>
                          <a href={prescription.pdf_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-3.5 w-3.5" />
                            Digital Copy
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
