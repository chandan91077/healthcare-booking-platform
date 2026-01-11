import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Heart,
    Shield,
    Users,
    Clock,
    Video,
    Calendar,
    Award,
    Target,
    Eye,
    CheckCircle2,
    Stethoscope,
    Globe,
} from "lucide-react";
import { Link } from "react-router-dom";

const values = [
    {
        icon: Heart,
        title: "Patient-Centric Care",
        description: "Your health and well-being are at the heart of everything we do.",
    },
    {
        icon: Shield,
        title: "Trust & Security",
        description: "We ensure complete privacy and security of your medical data.",
    },
    {
        icon: Award,
        title: "Quality Excellence",
        description: "Only verified, experienced doctors join our platform.",
    },
    {
        icon: Globe,
        title: "Accessibility",
        description: "Healthcare should be accessible to everyone, everywhere.",
    },
];

const features = [
    {
        icon: Video,
        title: "Online Consultations",
        description: "Connect with doctors via secure video calls from anywhere.",
    },
    {
        icon: Calendar,
        title: "Easy Booking",
        description: "Schedule appointments at your convenience in just a few clicks.",
    },
    {
        icon: Shield,
        title: "Verified Doctors",
        description: "All healthcare professionals are thoroughly verified and licensed.",
    },
    {
        icon: Clock,
        title: "24/7 Availability",
        description: "Access healthcare support whenever you need it, day or night.",
    },
];

const stats = [
    { value: "500+", label: "Verified Doctors" },
    { value: "50,000+", label: "Happy Patients" },
    { value: "100+", label: "Specializations" },
    { value: "24/7", label: "Support" },
];

const AboutUs = () => {
    return (
        <MainLayout>
            {/* Hero Section */}
            <section className="relative overflow-hidden gradient-primary text-white py-20 md:py-32">
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full bg-white/10 blur-3xl opacity-20" />
                    <div className="absolute -bottom-1/2 -left-1/2 w-full h-full rounded-full bg-black/10 blur-3xl opacity-20" />
                </div>
                <div className="container relative text-center max-w-4xl mx-auto px-4">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur mb-6 border border-white/20">
                        <Stethoscope className="h-4 w-4" />
                        <span className="text-sm font-medium">About MediConnect</span>
                    </div>
                    <h1 className="font-heading text-4xl md:text-6xl font-bold mb-6 leading-tight">
                        Transforming Healthcare,{" "}
                        <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
                            One Connection at a Time
                        </span>
                    </h1>
                    <p className="text-lg md:text-xl text-white/90 max-w-3xl mx-auto">
                        MediConnect is your trusted partner in accessible, affordable, and quality healthcare.
                        We bridge the gap between patients and verified medical professionals through innovative technology.
                    </p>
                </div>
            </section>

            {/* Mission & Vision */}
            <section className="py-20 container">
                <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
                    <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
                        <CardContent className="p-8">
                            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                                <Target className="h-7 w-7 text-primary" />
                            </div>
                            <h2 className="font-heading text-2xl md:text-3xl font-bold mb-4">Our Mission</h2>
                            <p className="text-muted-foreground text-lg leading-relaxed">
                                To make quality healthcare accessible and affordable for everyone by connecting patients
                                with verified doctors through a secure, user-friendly digital platform. We believe that
                                distance and time should never be barriers to receiving expert medical care.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
                        <CardContent className="p-8">
                            <div className="w-14 h-14 rounded-xl bg-info/10 flex items-center justify-center mb-6">
                                <Eye className="h-7 w-7 text-info" />
                            </div>
                            <h2 className="font-heading text-2xl md:text-3xl font-bold mb-4">Our Vision</h2>
                            <p className="text-muted-foreground text-lg leading-relaxed">
                                To become the most trusted healthcare platform where every individual can access
                                world-class medical expertise at their fingertips. We envision a future where healthcare
                                is seamless, transparent, and centered around patient needs.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* How We Connect */}
            <section className="py-20 bg-muted/30">
                <div className="container max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
                            How MediConnect Works
                        </h2>
                        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                            We've simplified healthcare access through our secure and intuitive platform
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full gradient-primary text-white font-heading text-2xl font-bold flex items-center justify-center mx-auto mb-6 shadow-glow">
                                1
                            </div>
                            <h3 className="font-heading text-xl font-semibold mb-3">Find Your Doctor</h3>
                            <p className="text-muted-foreground">
                                Browse through our network of verified doctors across multiple specializations.
                                Read reviews, check credentials, and choose the right expert for your needs.
                            </p>
                        </div>

                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full gradient-primary text-white font-heading text-2xl font-bold flex items-center justify-center mx-auto mb-6 shadow-glow">
                                2
                            </div>
                            <h3 className="font-heading text-xl font-semibold mb-3">Book Instantly</h3>
                            <p className="text-muted-foreground">
                                Schedule appointments at your convenience. Choose between video consultations
                                or in-person visits. Pay securely through our platform.
                            </p>
                        </div>

                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full gradient-primary text-white font-heading text-2xl font-bold flex items-center justify-center mx-auto mb-6 shadow-glow">
                                3
                            </div>
                            <h3 className="font-heading text-xl font-semibold mb-3">Get Expert Care</h3>
                            <p className="text-muted-foreground">
                                Connect with your doctor via video call or chat. Receive digital prescriptions,
                                follow-up reminders, and ongoing support for your health journey.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Key Features */}
            <section className="py-20 container">
                <div className="text-center mb-16">
                    <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
                        Why Choose MediConnect?
                    </h2>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        We combine technology with compassion to deliver exceptional healthcare experiences
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                    {features.map((feature, index) => (
                        <Card key={index} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-none shadow-sm">
                            <CardContent className="p-6 text-center">
                                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary group-hover:shadow-glow transition-all duration-300">
                                    <feature.icon className="h-7 w-7 text-primary group-hover:text-primary-foreground transition-colors" />
                                </div>
                                <h3 className="font-heading text-lg font-semibold mb-2">{feature.title}</h3>
                                <p className="text-muted-foreground text-sm">{feature.description}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Our Values */}
            <section className="py-20 bg-muted/30">
                <div className="container max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
                            Our Core Values
                        </h2>
                        <p className="text-muted-foreground text-lg">
                            The principles that guide everything we do
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {values.map((value, index) => (
                            <div key={index} className="text-center">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-info/20 flex items-center justify-center mx-auto mb-4">
                                    <value.icon className="h-8 w-8 text-primary" />
                                </div>
                                <h3 className="font-heading text-lg font-semibold mb-2">{value.title}</h3>
                                <p className="text-muted-foreground text-sm">{value.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-16 container">
                <div className="bg-gradient-to-r from-primary/5 to-info/5 rounded-3xl p-12 border">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {stats.map((stat, index) => (
                            <div key={index} className="text-center">
                                <p className="font-heading text-4xl md:text-5xl font-bold text-primary mb-2">
                                    {stat.value}
                                </p>
                                <p className="text-muted-foreground font-medium">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Trust & Security */}
            <section className="py-20 container">
                <div className="max-w-4xl mx-auto">
                    <Card className="border-none shadow-xl">
                        <CardContent className="p-8 md:p-12">
                            <div className="flex flex-col md:flex-row items-center gap-8">
                                <div className="flex-shrink-0">
                                    <div className="w-20 h-20 rounded-2xl bg-success/10 flex items-center justify-center">
                                        <Shield className="h-10 w-10 text-success" />
                                    </div>
                                </div>
                                <div className="flex-1 text-center md:text-left">
                                    <h2 className="font-heading text-2xl md:text-3xl font-bold mb-4">
                                        Your Trust is Our Priority
                                    </h2>
                                    <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                                        At MediConnect, we understand that healthcare is personal. That's why we've built
                                        our platform with industry-leading security standards. All doctors are verified,
                                        licensed professionals. Your medical data is encrypted and protected. Every consultation
                                        is confidential and secure.
                                    </p>
                                    <ul className="space-y-3 text-left">
                                        <li className="flex items-center gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                                            <span>End-to-end encrypted consultations</span>
                                        </li>
                                        <li className="flex items-center gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                                            <span>HIPAA-compliant data protection</span>
                                        </li>
                                        <li className="flex items-center gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                                            <span>Verified and licensed healthcare professionals</span>
                                        </li>
                                        <li className="flex items-center gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                                            <span>Secure payment processing</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 container">
                <div className="bg-gradient-to-r from-primary to-info p-12 md:p-16 rounded-3xl text-white text-center shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 -mr-12 -mt-12 bg-white/10 rounded-full blur-2xl h-64 w-64 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 p-12 -ml-12 -mb-12 bg-black/10 rounded-full blur-2xl h-64 w-64 pointer-events-none"></div>

                    <div className="relative z-10 max-w-3xl mx-auto">
                        <h2 className="font-heading text-3xl md:text-4xl font-bold mb-6">
                            Ready to Experience Better Healthcare?
                        </h2>
                        <p className="text-lg text-white/90 mb-8">
                            Join thousands of patients who trust MediConnect for their healthcare needs.
                            Start your journey to better health today.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button size="lg" variant="secondary" className="font-semibold" asChild>
                                <Link to="/doctors">Find a Doctor</Link>
                            </Button>
                            <Button
                                size="lg"
                                variant="outline"
                                className="bg-transparent text-white border-white hover:bg-white/10 font-semibold"
                                asChild
                            >
                                <Link to="/auth?mode=signup">Sign Up Free</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </section>
        </MainLayout>
    );
};

export default AboutUs;
