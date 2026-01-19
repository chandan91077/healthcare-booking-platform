import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuthContext } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Star,
  Clock,
  IndianRupee,
  Filter,
  Stethoscope,
  CheckCircle2,
  MapPin,
} from "lucide-react";

interface Doctor {
  id: string;
  user_id: string;
  specialization: string;
  experience_years: number;
  consultation_fee: number;
  emergency_fee: number;
  bio: string | null;
  profile_image_url: string | null;
  profile: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
  state?: string;
  location?: string;
}

const specializations = [
  "All Specializations",
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
];

export default function Doctors() {
  const navigate = useNavigate();
  const { user, role } = useAuthContext();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedSpecialization, setSelectedSpecialization] = useState("All Specializations");
  const [sortBy, setSortBy] = useState("experience");

  // Generate random rating and review count for each doctor
  const generateRating = (doctorId: string) => {
    const seed = doctorId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const rating = 4.0 + ((seed % 10) / 10); // Generates rating between 4.0 and 4.9
    const reviews = 50 + (seed % 150); // Generates review count between 50 and 200
    return {
      rating: parseFloat(rating.toFixed(1)),
      reviews
    };
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const handler = setTimeout(async () => {
      try {
        const params: any = {};
        if (selectedState) params.state = selectedState;
        const { data: doctorsData } = await api.get('/doctors', { params });

        // Backend returns doctors with populated user_id (which contains full_name, email, avatar_url)
        const mappedDoctors = doctorsData.map((doc: any) => ({
          ...doc,
          id: doc._id,
          profile: doc.user_id ? {
            full_name: doc.user_id.full_name,
            email: doc.user_id.email,
            avatar_url: doc.user_id.avatar_url
          } : null,
          state: doc.state,
          location: doc.location
        }));

        if (mounted) setDoctors(mappedDoctors);
      } catch (error) {
        console.error("Error fetching doctors:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }, 300);

    return () => {
      mounted = false;
      clearTimeout(handler);
    };
  }, [selectedState]);

  // Only patients can book appointments
  const canBook = role === "patient";

  useEffect(() => {
    async function fetchDoctors() {
      try {
        const { data: doctorsData } = await api.get('/doctors');

        // Backend returns doctors with populated user_id (which contains full_name, email, avatar_url)
        const mappedDoctors = doctorsData.map((doc: any) => ({
          ...doc,
          id: doc._id,
          profile: doc.user_id ? {
            full_name: doc.user_id.full_name,
            email: doc.user_id.email,
            avatar_url: doc.user_id.avatar_url
          } : null
        }));

        setDoctors(mappedDoctors);
      } catch (error) {
        console.error("Error fetching doctors:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDoctors();
  }, []);

  const filteredDoctors = doctors
    .filter((doc) => {
      const matchesSearch =
        doc.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.specialization.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSpecialization =
        selectedSpecialization === "All Specializations" ||
        doc.specialization === selectedSpecialization;
      return matchesSearch && matchesSpecialization;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "experience":
          return b.experience_years - a.experience_years;
        case "fee_low":
          return a.consultation_fee - b.consultation_fee;
        case "fee_high":
          return b.consultation_fee - a.consultation_fee;
        default:
          return 0;
      }
    });

  return (
    <MainLayout>
      <div className="bg-muted/50 py-12 border-b">
        <div className="container">
          <h1 className="font-heading text-3xl md:text-4xl font-bold mb-4">
            Find a Doctor
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Browse our network of verified healthcare professionals and book your
            consultation today.
          </p>
        </div>
      </div>

      <div className="container py-8">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or specialization..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="relative w-full md:w-[220px]">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="stateFilter"
              placeholder="State (optional)"
              className="pl-10"
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
            />
            {selectedState && (
              <button
                type="button"
                onClick={() => setSelectedState("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
              >
                Clear
              </button>
            )}
          </div>

          <Select value={selectedSpecialization} onValueChange={setSelectedSpecialization}>
            <SelectTrigger className="w-full md:w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Specialization" />
            </SelectTrigger>
            <SelectContent>
              {specializations.map((spec) => (
                <SelectItem key={spec} value={spec}>
                  {spec}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="experience">Most Experienced</SelectItem>
              <SelectItem value="fee_low">Price: Low to High</SelectItem>
              <SelectItem value="fee_high">Price: High to Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : filteredDoctors.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Stethoscope className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="font-heading text-xl font-semibold mb-2">
                No Doctors Found
              </h3>
              <p className="text-muted-foreground">
                {doctors.length === 0
                  ? "No verified doctors are available at the moment. Please check back later."
                  : "Try adjusting your search filters to find doctors."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Showing {filteredDoctors.length} doctor{filteredDoctors.length !== 1 ? "s" : ""}
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDoctors.map((doctor) => (
                <Card
                  key={doctor.id}
                  className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                      <Avatar className="h-16 w-16 border-2 border-primary/10">
                        <AvatarImage
                          src={doctor.profile_image_url || doctor.profile?.avatar_url || undefined}
                          alt={`Dr. ${doctor.profile?.full_name || 'Doctor'}`}
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                          {doctor.profile?.full_name?.charAt(0) || "D"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-heading font-semibold truncate">
                            Dr. {doctor.profile?.full_name || "Unknown"}
                          </h3>
                          <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                        </div>
                        <Badge variant="secondary" className="mb-2">
                          {doctor.specialization}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm text-warning">
                          <Star className="h-4 w-4 fill-current" />
                          <span>{generateRating(doctor.id).rating}</span>
                          <span className="text-muted-foreground">({generateRating(doctor.id).reviews} reviews)</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{doctor.experience_years} years experience</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <IndianRupee className="h-4 w-4 text-primary" />
                        <span className="font-medium">₹{doctor.consultation_fee}</span>
                        <span className="text-muted-foreground">/ consultation</span>
                      </div>
                      {doctor.state && (
                        <div className="flex items-center gap-2 text-muted-foreground mt-2">
                          <MapPin className="h-4 w-4" />
                          <span>{doctor.state}{doctor.location ? ` • ${doctor.location}` : ''}</span>
                        </div>
                      )}
                    </div>

                    {doctor.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {doctor.bio}
                      </p>
                    )}

                    <div className="flex gap-2">
                      {canBook && (
                        <Button asChild className="flex-1">
                          <Link to={`/book/${doctor.id}`}>Book Now</Link>
                        </Button>
                      )}
                      {!user && (
                        <Button className="flex-1" onClick={() => navigate("/auth")}>
                          Login to Book
                        </Button>
                      )}
                      {user && role === "doctor" && (
                        <span className="flex-1 text-sm text-muted-foreground text-center py-2">
                          Doctors cannot book
                        </span>
                      )}
                      <Button variant="outline" asChild>
                        <Link to={`/doctor/${doctor.id}`}>View Profile</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
