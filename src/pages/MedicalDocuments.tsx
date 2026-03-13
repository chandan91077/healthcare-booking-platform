import { useEffect, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuthContext } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { uploadToS3 } from "@/lib/s3-upload";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Upload, FileText, Trash2, ExternalLink } from "lucide-react";

interface MedicalRecord {
  _id: string;
  file_name: string;
  file_url: string;
  mime_type: string;
  file_size: number;
  record_type: "Lab Reports" | "Prescriptions" | "Invoices" | "Other";
  notes: string;
  createdAt: string;
}

const RECORD_TYPES: Array<MedicalRecord["record_type"]> = ["Lab Reports", "Prescriptions", "Invoices", "Other"];

export default function MedicalDocuments() {
  const { isLoading, isAuthenticated, role } = useAuthContext();
  const navigate = useNavigate();

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [recordType, setRecordType] = useState<MedicalRecord["record_type"]>("Other");
  const [notes, setNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
      return;
    }
    if (!isLoading && role && role !== "patient") {
      navigate("/");
    }
  }, [isLoading, isAuthenticated, role, navigate]);

  const fetchRecords = async () => {
    try {
      const { data } = await api.get('/medical-records');
      setRecords(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to load medical documents");
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    if (!isLoading && isAuthenticated && role === "patient") {
      fetchRecords();
    }
  }, [isLoading, isAuthenticated, role]);

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please choose a file first");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setUploading(true);
    try {
      const fileUrl = await uploadToS3(selectedFile);
      if (!fileUrl) {
        toast.error("Failed to upload file");
        return;
      }

      await api.post('/medical-records', {
        file_name: selectedFile.name,
        file_url: fileUrl,
        mime_type: selectedFile.type || '',
        file_size: selectedFile.size,
        record_type: recordType,
        notes: notes.trim(),
      });

      setSelectedFile(null);
      setNotes("");
      setRecordType("Other");
      if (fileInputRef.current) fileInputRef.current.value = "";

      toast.success("Medical document uploaded");
      await fetchRecords();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to upload medical document");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (recordId: string) => {
    try {
      await api.delete(`/medical-records/${recordId}`);
      setRecords((prev) => prev.filter((record) => record._id !== recordId));
      toast.success("Medical document deleted");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete medical document");
    }
  };

  if (isLoading || loadingRecords) {
    return (
      <MainLayout>
        <div className="container py-8">
          <Skeleton className="h-8 w-64 mb-8" />
          <Skeleton className="h-56 mb-6" />
          <Skeleton className="h-72" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container py-8 space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-bold mb-2">Medical Documents</h1>
          <p className="text-muted-foreground">Upload and manage your health records</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload Document</CardTitle>
            <CardDescription>Add medical files like lab reports, prescriptions, and invoices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Choose File</label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="mt-1"
                />
                {selectedFile ? (
                  <p className="text-xs text-muted-foreground mt-2">
                    {selectedFile.name} ({Math.ceil(selectedFile.size / 1024)} KB)
                  </p>
                ) : null}
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <select
                  value={recordType}
                  onChange={(e) => setRecordType(e.target.value as MedicalRecord["record_type"])}
                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                >
                  {RECORD_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any details for this document"
                className="mt-1"
              />
            </div>

            <Button onClick={handleUpload} disabled={uploading || !selectedFile}>
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Uploading..." : "Upload Document"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No documents uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {records.map((record) => (
                  <div key={record._id} className="border rounded-lg p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{record.file_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{record.record_type}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(record.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {record.notes ? <p className="text-sm text-muted-foreground mt-2">{record.notes}</p> : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={record.file_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View
                        </a>
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(record._id)}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
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