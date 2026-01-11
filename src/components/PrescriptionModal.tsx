import { useState, useRef } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileText, Plus, Trash2, Loader2, Upload, FileUp } from "lucide-react";
import { uploadToS3 } from "@/lib/s3-upload";

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

interface PrescriptionModalProps {
  appointmentId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialization: string;
  onSuccess?: () => void;
}

export function PrescriptionModal({
  appointmentId,
  patientId,
  patientName,
  doctorId,
  doctorName,
  doctorSpecialization,
  onSuccess,
}: PrescriptionModalProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [diagnosis, setDiagnosis] = useState("");
  const [instructions, setInstructions] = useState("");
  const [doctorNotes, setDoctorNotes] = useState("");
  const [medications, setMedications] = useState<Medication[]>([
    { name: "", dosage: "", frequency: "", duration: "" },
  ]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addMedication = () => {
    setMedications([
      ...medications,
      { name: "", dosage: "", frequency: "", duration: "" },
    ]);
  };

  const removeMedication = (index: number) => {
    if (medications.length > 1) {
      setMedications(medications.filter((_, i) => i !== index));
    }
  };

  const updateMedication = (
    index: number,
    field: keyof Medication,
    value: string
  ) => {
    const updated = [...medications];
    updated[index][field] = value;
    setMedications(updated);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!diagnosis.trim()) {
      toast.error("Please enter a diagnosis");
      return;
    }

    const validMedications = medications.filter(
      (m) => m.name.trim() && m.dosage.trim()
    );

    if (validMedications.length === 0) {
      toast.error("Please add at least one medication");
      return;
    }

    setIsSubmitting(true);

    try {
      let pdfUrl = "";
      if (selectedFile) {
        toast.loading("Uploading file to S3...");
        const uploadedUrl = await uploadToS3(selectedFile);
        if (!uploadedUrl) {
          toast.error("Failed to upload file. Continuing without file.");
        } else {
          pdfUrl = uploadedUrl;
        }
      }

      await api.post('/prescriptions', {
        appointment_id: appointmentId,
        patient_id: patientId,
        doctor_id: doctorId,
        diagnosis,
        medications: validMedications,
        instructions,
        doctor_notes: doctorNotes,
        pdf_url: pdfUrl,
      });

      toast.success("Prescription created successfully");
      setOpen(false);

      // Reset form
      setDiagnosis("");
      setInstructions("");
      setDoctorNotes("");
      setMedications([{ name: "", dosage: "", frequency: "", duration: "" }]);
      setSelectedFile(null);

      onSuccess?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create prescription";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
      toast.dismiss(); // Remove any loading toasts
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <FileText className="h-4 w-4 mr-1" />
          Prescribe
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Prescription</DialogTitle>
          <DialogDescription>
            Create a detailed medical prescription for {patientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Diagnosis */}
          <div className="space-y-2">
            <Label htmlFor="diagnosis">Diagnosis *</Label>
            <Input
              id="diagnosis"
              placeholder="e.g., Acute Pharyngitis"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
            />
          </div>

          {/* Medications */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Medications *</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                onClick={addMedication}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add medication
              </Button>
            </div>

            <div className="space-y-3">
              {medications.map((med, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 bg-muted/30 rounded-xl border relative group"
                >
                  <div className="md:col-span-4 space-y-1.5">
                    <Label className="text-xs text-muted-foreground ml-1">Name</Label>
                    <Input
                      placeholder="Medication name"
                      value={med.name}
                      onChange={(e) =>
                        updateMedication(index, "name", e.target.value)
                      }
                      className="bg-background"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs text-muted-foreground ml-1">Dosage</Label>
                    <Input
                      placeholder="e.g. 500mg"
                      value={med.dosage}
                      onChange={(e) =>
                        updateMedication(index, "dosage", e.target.value)
                      }
                      className="bg-background"
                    />
                  </div>
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs text-muted-foreground ml-1">Frequency</Label>
                    <Input
                      placeholder="e.g. Twice daily"
                      value={med.frequency}
                      onChange={(e) =>
                        updateMedication(index, "frequency", e.target.value)
                      }
                      className="bg-background"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs text-muted-foreground ml-1">Duration</Label>
                    <Input
                      placeholder="e.g. 7 days"
                      value={med.duration}
                      onChange={(e) =>
                        updateMedication(index, "duration", e.target.value)
                      }
                      className="bg-background"
                    />
                  </div>
                  <div className="md:col-span-1 flex items-end justify-center pb-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeMedication(index)}
                      disabled={medications.length === 1}
                      className="h-9 w-9 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Instructions */}
            <div className="space-y-2">
              <Label htmlFor="instructions" className="font-semibold">Patient Instructions</Label>
              <Textarea
                id="instructions"
                placeholder="How to take medicine, lifestyle advice..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="min-h-[120px]"
              />
            </div>

            {/* Doctor Notes (Deep Details) */}
            <div className="space-y-2">
              <Label htmlFor="doctorNotes" className="font-semibold">Doctor Notes (Clinical Details)</Label>
              <Textarea
                id="doctorNotes"
                placeholder="Detailed clinical notes, observations, or long-form medical history (supports up to 500+ words)..."
                value={doctorNotes}
                onChange={(e) => setDoctorNotes(e.target.value)}
                className="min-h-[120px]"
              />
              <p className="text-[10px] text-muted-foreground text-right">
                {doctorNotes.split(/\s+/).filter(Boolean).length} / 500+ words
              </p>
            </div>
          </div>

          {/* S3 File Upload */}
          <div className="space-y-2 p-4 border rounded-xl bg-primary/5">
            <Label className="font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Upload Digital Copy (Optional)
            </Label>
            <p className="text-xs text-muted-foreground mb-3">
              Upload a scanned prescription or reference document (Max 5MB, PDF or Image)
            </p>

            <div className="flex items-center gap-4">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".pdf,image/*"
                onChange={handleFileChange}
              />
              <Button
                variant="outline"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-background"
              >
                {selectedFile ? "Change File" : "Select File"}
              </Button>
              {selectedFile && (
                <div className="flex items-center gap-2 text-sm text-primary font-medium">
                  <FileUp className="h-4 w-4" />
                  {selectedFile.name}
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="ml-2 text-destructive hover:underline text-xs"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Discard
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="min-w-[140px]">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Issue Prescription"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
