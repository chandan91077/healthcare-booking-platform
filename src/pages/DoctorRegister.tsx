import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuthContext } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast"; // Correct hook
import api from "@/lib/api";
import { uploadToS3 } from "@/lib/s3-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, Stethoscope, ArrowLeft, User, MapPin } from "lucide-react";
import { toast } from "sonner"; // Using sonner for toasts as seen in other files

const specializations = [
  "General Medicine",
  "Cardiology",
  "Dermatology",
  "Orthopedics",
  "Pediatrics",
  "Neurology",
  "Psychiatry",
  "Gynecology",
  "Ophthalmology",
  "ENT",
  "Gastroenterology",
  "Pulmonology",
  "Endocrinology",
  "Nephrology",
  "Oncology",
  "Rheumatology",
  "Urology",
  "Other",
];

const doctorRegistrationSchema = z.object({
  specialization: z.string().min(1, "Please select a specialization"),
  experienceYears: z.number().min(0).max(60),
  consultationFee: z.number().min(100, "Minimum consultation fee is ₹100"),
  emergencyFee: z.number().min(200, "Minimum emergency fee is ₹200"),
  state: z.string().min(1, "Please enter your state"),
  location: z.string().max(200, "Location must be less than 200 characters").optional(),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
});

type DoctorRegistrationFormData = z.infer<typeof doctorRegistrationSchema>;

export default function DoctorRegister() {
  const { user, isLoading, isAuthenticated } = useAuthContext();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);

  const form = useForm<DoctorRegistrationFormData>({
    resolver: zodResolver(doctorRegistrationSchema),
    defaultValues: {
      specialization: "",
      experienceYears: 0,
      consultationFee: 500,
      emergencyFee: 1000,
      state: "",
      location: "",
      bio: "",
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }
      setLicenseFile(file);
    }
  };

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Profile image must be less than 2MB");
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast.error("Please upload an image file");
        return;
      }
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (data: DoctorRegistrationFormData) => {
    if (!user) { // user context might be slightly different now with api auth
      toast.error("You must be logged in to register");
      return;
    }

    if (!licenseFile) {
      toast.error("Please upload your medical license");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload license file to S3
      const licenseUrl = await uploadToS3(licenseFile);

      // Upload profile image if provided
      let profileImageUrl: string | null = null;
      if (profileImage) {
        profileImageUrl = await uploadToS3(profileImage);
      }

      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = userData._id || user.id;

      // First, check if doctor profile already exists
      try {
        const existingDoctor = await api.get(`/doctors/user/${userId}`);
        
        // Doctor exists, update it
        if (existingDoctor.data) {
          await api.put(`/doctors/${existingDoctor.data._id}`, {
            specialization: data.specialization,
            experience_years: data.experienceYears,
            consultation_fee: data.consultationFee,
            emergency_fee: data.emergencyFee,
            bio: data.bio,
            state: data.state,
            location: data.location,
            medical_license_url: licenseUrl,
            profile_image_url: profileImageUrl,
            is_verified: false,
            verification_status: "pending"
          });
          toast.success("Application resubmitted successfully!");
        }
      } catch (err: any) {
        // Doctor doesn't exist, create new one
        if (err.response?.status === 404) {
          await api.post('/doctors', {
            user_id: userId,
            specialization: data.specialization,
            experience_years: data.experienceYears,
            consultation_fee: data.consultationFee,
            emergency_fee: data.emergencyFee,
            bio: data.bio,
            state: data.state,
            location: data.location,
            medical_license_url: licenseUrl,
            profile_image_url: profileImageUrl,
            is_verified: false,
            verification_status: "pending"
          });
          toast.success("Registration submitted successfully!");
        } else {
          throw err;
        }
      }
      
      navigate("/dashboard");
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to submit registration");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container py-8 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  // Basic auth check
  const loggedInUser = localStorage.getItem('user');
  if (!loggedInUser && !isAuthenticated) {
    navigate("/auth?mode=signup&role=doctor");
    return null;
  }

  return (
    <MainLayout>
      <div className="container py-8 max-w-2xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Stethoscope className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Complete Your Doctor Profile</CardTitle>
            <CardDescription>
              Provide your professional details for verification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">

              {/* Profile Image Section */}
              <div className="space-y-2">
                <Label>Profile Photo (Optional)</Label>
                <div className="flex items-center gap-4">
                  <div className="h-24 w-24 rounded-full border-2 border-dashed border-border overflow-hidden flex items-center justify-center bg-muted">
                    {profileImagePreview ? (
                      <img src={profileImagePreview} alt="Preview" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-10 w-10 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <input type="file" id="profileImage" accept="image/*" onChange={handleProfileImageChange} className="hidden" />
                    <label htmlFor="profileImage">
                      <Button type="button" variant="outline" asChild>
                        <span className="cursor-pointer"><Upload className="h-4 w-4 mr-2" /> {profileImage ? "Change" : "Upload"}</span>
                      </Button>
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialization">Specialization *</Label>
                <Select onValueChange={(val) => form.setValue("specialization", val)} defaultValue={form.getValues("specialization")}>
                  <SelectTrigger><SelectValue placeholder="Select specialization" /></SelectTrigger>
                  <SelectContent>
                    {specializations.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.formState.errors.specialization && <p className="text-sm text-destructive">{form.formState.errors.specialization.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="experienceYears">Years of Experience *</Label>
                <Input id="experienceYears" type="number" {...form.register("experienceYears", { valueAsNumber: true })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Input id="state" placeholder="e.g. Karnataka" {...form.register("state")} />
                  {form.formState.errors.state && <p className="text-sm text-destructive">{form.formState.errors.state.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location (City / Address)</Label>
                  <Input id="location" placeholder="e.g. Bengaluru, Jayanagar" {...form.register("location")} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="consultationFee">Consultation Fee (₹) *</Label>
                  <Input id="consultationFee" type="number" {...form.register("consultationFee", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyFee">Emergency Fee (₹) *</Label>
                  <Input id="emergencyFee" type="number" {...form.register("emergencyFee", { valueAsNumber: true })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea id="bio" {...form.register("bio")} />
              </div>

              <div className="space-y-2">
                <Label>Medical License *</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <input type="file" id="license" accept=".pdf,.jpg,.png" onChange={handleFileChange} className="hidden" />
                  <label htmlFor="license" className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto mb-2" />
                    <p>{licenseFile ? licenseFile.name : "Click to upload license"}</p>
                  </label>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit
              </Button>

            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
