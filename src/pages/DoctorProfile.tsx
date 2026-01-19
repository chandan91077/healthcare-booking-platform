import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IndianRupee, MapPin, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function DoctorProfile() {
  const { doctorId } = useParams();
  const [doctor, setDoctor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCertificate, setShowCertificate] = useState(false);

  useEffect(() => {
    async function fetchDoctor() {
      if (!doctorId) return;
      try {
        const { data } = await api.get(`/doctors/${doctorId}`);
        setDoctor(data);
      } catch (error: any) {
        console.error(error);
        toast.error("Doctor not found");
      } finally {
        setLoading(false);
      }
    }
    fetchDoctor();
  }, [doctorId]);

  if (loading) {
    return (
      <MainLayout>
        <div className="container py-8">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="grid md:grid-cols-3 gap-8">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!doctor) return null;

  return (
    <MainLayout>
      <div className="container py-8 max-w-4xl mx-auto">
        <div className="flex items-start gap-6 mb-6">
          <Avatar className="h-24 w-24">
            {(doctor.profile_image_url || doctor.user_id?.avatar_url) ? (
              <AvatarImage 
                src={doctor.profile_image_url || doctor.user_id.avatar_url} 
                alt={doctor.user_id.full_name}
                className="object-cover"
              />
            ) : (
              <AvatarFallback className="bg-primary/10 text-primary text-2xl">{doctor.user_id?.full_name?.charAt(0) || 'D'}</AvatarFallback>
            )}
          </Avatar>
          <div>
            <h1 className="font-heading text-3xl font-bold">Dr. {doctor.user_id?.full_name}</h1>
            <p className="text-muted-foreground">{doctor.specialization} • ₹{doctor.consultation_fee} per consultation</p>
            { (doctor.state || doctor.location) && (
              <p className="mt-2 flex items-center text-sm text-muted-foreground gap-2"><MapPin className="h-4 w-4" />{doctor.state}{doctor.location ? ` • ${doctor.location}` : ''}</p>
            )}
            <div className="mt-4">
              <Link to={`/book/${doctor._id}`}>
                <Button>Book Now</Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>About</CardTitle>
                <CardDescription>Doctor bio and credentials</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{doctor.bio || "No bio provided."}</p>
              </CardContent>
            </Card>

            {doctor.medical_license_url && (
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Certificate</CardTitle>
                      <CardDescription>Uploaded medical license</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCertificate(!showCertificate)}
                    >
                      {showCertificate ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-2" />
                          Hide
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                {showCertificate && (
                  <CardContent>
                    <a href={doctor.medical_license_url} target="_blank" rel="noopener noreferrer">
                      <img src={doctor.medical_license_url} alt="Certificate" className="max-w-full rounded" />
                    </a>
                  </CardContent>
                )}
              </Card>
            )}
          </div>

        </div>
      </div>
    </MainLayout>
  );
}
