import { useState, useEffect } from "react";
import api from "@/lib/api";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { History, FileText, Pill, Stethoscope, Download } from "lucide-react";

interface Medication {
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
}

interface Prescription {
    _id: string;
    diagnosis: string;
    medications: Medication[];
    instructions: string;
    doctor_notes: string;
    pdf_url: string;
    createdAt: string;
    doctor_id: {
        user_id: {
            full_name: string;
        };
    };
}

interface PatientHistoryModalProps {
    patientId: string;
    patientName: string;
}

export function PatientHistoryModal({ patientId, patientName }: PatientHistoryModalProps) {
    const [open, setOpen] = useState(false);
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && patientId) {
            fetchHistory();
        }
    }, [open, patientId]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/prescriptions/patient/${patientId}`);
            setPrescriptions(data);
        } catch (error) {
            console.error("Error fetching patient history:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="ghost" className="gap-2">
                    <History className="h-4 w-4" />
                    View History
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Medical History: {patientName}</DialogTitle>
                    <DialogDescription>
                        Review previous prescriptions and clinical notes for this patient.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 mt-4 pr-4">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-32 w-full" />
                            ))}
                        </div>
                    ) : prescriptions.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>No previous prescriptions found for this patient.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {prescriptions.map((px) => (
                                <div key={px._id} className="border rounded-xl p-4 bg-muted/30 relative group">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-bold text-primary flex items-center gap-2">
                                                <Stethoscope className="h-4 w-4" />
                                                {px.diagnosis}
                                            </h4>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                By Dr. {px.doctor_id?.user_id?.full_name} • {format(new Date(px.createdAt), "MMM d, yyyy")}
                                            </p>
                                        </div>
                                        {px.pdf_url && (
                                            <Button size="icon" variant="outline" className="h-8 w-8" asChild>
                                                <a href={px.pdf_url} target="_blank" rel="noopener noreferrer">
                                                    <Download className="h-3.5 w-3.5" />
                                                </a>
                                            </Button>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex flex-wrap gap-2">
                                            {px.medications.map((m, idx) => (
                                                <Badge key={idx} variant="secondary" className="px-2 py-0 text-[10px] font-normal">
                                                    <Pill className="h-3 w-3 mr-1 opacity-50" />
                                                    {m.name} ({m.dosage})
                                                </Badge>
                                            ))}
                                        </div>

                                        {px.instructions && (
                                            <div className="text-xs">
                                                <span className="font-semibold block mb-0.5">Instructions:</span>
                                                <p className="text-muted-foreground leading-relaxed">{px.instructions}</p>
                                            </div>
                                        )}

                                        {px.doctor_notes && (
                                            <div className="text-xs border-t pt-2 mt-2 italic text-muted-foreground">
                                                <span className="font-semibold not-italic block mb-0.5">Clinical Notes:</span>
                                                {px.doctor_notes}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
