import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Heart,
  Shield,
  Video,
  MessageSquare,
  Calendar,
  FileText,
  Clock,
  Users,
  CheckCircle2,
  ArrowRight,
  Stethoscope,
} from "lucide-react";

const features = [
  {
    icon: Video,
    title: "Video Consultations",
    description: "Connect with doctors through secure HD video calls from anywhere.",
  },
  {
    icon: MessageSquare,
    title: "Real-time Chat",
    description: "Message your doctor directly and share files, reports, and images.",
  },
  {
    icon: Calendar,
    title: "Easy Scheduling",
    description: "Book appointments at your convenience with just a few clicks.",
  },
  {
    icon: FileText,
    title: "Digital Prescriptions",
    description: "Receive and access prescriptions digitally, anytime.",
  },
  {
    icon: Shield,
    title: "Verified Doctors",
    description: "All doctors are thoroughly verified before joining our platform.",
  },
  {
    icon: Clock,
    title: "Emergency Care",
    description: "Get immediate access to doctors for urgent health concerns.",
  },
];

const stats = [
  { value: "500+", label: "Verified Doctors" },
  { value: "50,000+", label: "Consultations" },
  { value: "4.9/5", label: "Patient Rating" },
  { value: "24/7", label: "Availability" },
];

export default function Index() {
  return (
    <MainLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden gradient-hero text-white">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/2 w-full h-full rounded-full bg-info/10 blur-3xl" />
        </div>
        <div className="container relative py-24 md:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur mb-6">
              <Heart className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium">Your Health, Our Priority</span>
            </div>
            <h1 className="font-heading text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Healthcare Made{" "}
              <span className="bg-gradient-to-r from-primary to-info bg-clip-text text-transparent">
                Simple & Accessible
              </span>
            </h1>
            <p className="text-lg md:text-xl text-white/80 mb-8 max-w-2xl mx-auto">
              Connect with verified doctors instantly. Book appointments, video
              consultations, and manage your health—all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="gradient-accent text-white border-0" asChild>
                <Link to="/auth?mode=signup">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                asChild
              >
                <Link to="/doctors">Find a Doctor</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-card border-b">
        <div className="container">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <p className="font-heading text-3xl md:text-4xl font-bold text-primary mb-1">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-28">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
              Everything You Need for Better Healthcare
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our platform offers a comprehensive suite of features designed to make
              healthcare accessible, convenient, and efficient.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1"
              >
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:shadow-glow transition-all duration-300">
                    <feature.icon className="h-6 w-6 text-primary group-hover:text-primary-foreground transition-colors" />
                  </div>
                  <h3 className="font-heading text-xl font-semibold mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-muted/50">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Getting healthcare has never been easier. Follow these simple steps to
              connect with a doctor.
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: "1", title: "Sign Up", desc: "Create your free account" },
              { step: "2", title: "Find Doctor", desc: "Browse verified specialists" },
              { step: "3", title: "Book & Pay", desc: "Schedule and pay securely" },
              { step: "4", title: "Consult", desc: "Connect via video or chat" },
            ].map((item, index) => (
              <div key={index} className="text-center relative">
                <div className="h-16 w-16 rounded-full gradient-primary text-white font-heading text-2xl font-bold flex items-center justify-center mx-auto mb-4 shadow-glow">
                  {item.step}
                </div>
                <h3 className="font-heading text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
                {index < 3 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-[2px] bg-gradient-to-r from-primary/50 to-transparent" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Doctors Section */}
      <section className="py-20">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 mb-6">
                <Stethoscope className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">For Doctors</span>
              </div>
              <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
                Join Our Network of Healthcare Professionals
              </h2>
              <p className="text-muted-foreground mb-6">
                Expand your practice online. Connect with patients across the country,
                manage your schedule, and grow your practice with our platform.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Reach more patients online",
                  "Flexible scheduling and availability",
                  "Secure payment processing",
                  "Digital prescription management",
                ].map((benefit, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
              <Button size="lg" asChild>
                <Link to="/auth?mode=signup&role=doctor">
                  Register as Doctor
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-2xl gradient-hero p-8 flex items-center justify-center">
                <div className="text-center text-white">
                  <Users className="h-24 w-24 mx-auto mb-6 opacity-80" />
                  <p className="font-heading text-2xl font-bold mb-2">500+ Doctors</p>
                  <p className="text-white/70">Already trust our platform</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 gradient-primary">
        <div className="container text-center">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Take Control of Your Health?
          </h2>
          <p className="text-white/80 max-w-2xl mx-auto mb-8">
            Join thousands of patients who trust MediConnect for their healthcare needs.
            Sign up today and get your first consultation.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-white text-primary hover:bg-white/90" asChild>
              <Link to="/auth?mode=signup">
                Create Free Account
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10"
              asChild
            >
              <Link to="/doctors">Browse Doctors</Link>
            </Button>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
