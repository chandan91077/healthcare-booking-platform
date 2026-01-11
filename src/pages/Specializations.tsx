import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Heart,
    Brain,
    Bone,
    Baby,
    Stethoscope,
    Activity,
    Search,
    ShieldCheck,
    CreditCard,
    Video,
    MapPin,
    UserCheck
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

const specializations = [
    {
        title: "Cardiology",
        description: "Expert care for your heart and cardiovascular system.",
        icon: Heart,
        color: "text-red-500",
        bg: "bg-red-500/10",
    },
    {
        title: "Neurology",
        description: "Diagnosis and treatment of nervous system disorders.",
        icon: Brain,
        color: "text-purple-500",
        bg: "bg-purple-500/10",
    },
    {
        title: "Orthopedics",
        description: "Care for bones, joints, ligaments, and muscles.",
        icon: Bone,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
    },
    {
        title: "Pediatrics",
        description: "Medical care for infants, children, and adolescents.",
        icon: Baby,
        color: "text-green-500",
        bg: "bg-green-500/10",
    },
    {
        title: "Dermatology",
        description: "Treatment for skin, hair, and nail conditions.",
        icon: Activity, // Using Activity as a placeholder for skin if no direct icon exists or generic
        color: "text-pink-500",
        bg: "bg-pink-500/10",
    },
    {
        title: "Gynecology",
        description: "Health care for women's reproductive health.",
        icon: Stethoscope,
        color: "text-rose-500",
        bg: "bg-rose-500/10",
    },
    {
        title: "Psychiatry",
        description: "Mental health support and treatment.",
        icon: Brain, // Reusing Brain or finding another mental health appropriate one
        color: "text-indigo-500",
        bg: "bg-indigo-500/10",
    },
    {
        title: "General Medicine",
        description: "Comprehensive care for all your general health needs.",
        icon: Stethoscope,
        color: "text-cyan-500",
        bg: "bg-cyan-500/10",
    },
];

const features = [
    {
        icon: ShieldCheck,
        title: "Verified Doctors",
        description: "Every doctor on our platform is thoroughly vetted and verified.",
    },
    {
        icon: UserCheck,
        title: "Patient Reviews",
        description: "Read real reviews from other patients to make informed choices.",
    },
    {
        icon: CreditCard,
        title: "Affordable Care",
        description: "Transparent pricing with no hidden fees.",
    },
    {
        icon: Video,
        title: "Online & Offline",
        description: "Choose between video consultations or clinic visits.",
    },
];

const Specializations = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();

    const handleSearch = () => {
        if (searchQuery.trim()) {
            navigate(`/doctors?search=${encodeURIComponent(searchQuery)}`);
        } else {
            navigate('/doctors');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

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
                        <span className="text-sm font-medium">Expert Care For Every Need</span>
                    </div>
                    <h1 className="font-heading text-4xl md:text-6xl font-bold mb-6 leading-tight">
                        Find the Right Specialist for Your Health
                    </h1>
                    <p className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                        From cardiology to pediatrics, connect with top-rated medical experts across all major specializations.
                        Your health journey starts here.
                    </p>

                    {/* Search Bar */}
                    <div className="max-w-md mx-auto relative hidden md:block">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search specializations (e.g. Heart, Skin...)"
                                className="w-full pl-10 pr-4 py-3 rounded-full bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-white/50 shadow-lg"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={handleKeyPress}
                            />
                            <Button
                                size="sm"
                                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full"
                                onClick={handleSearch}
                            >
                                Search
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Introduction to Specializations */}
            <section className="py-16 bg-muted/30">
                <div className="container max-w-4xl mx-auto text-center">
                    <h2 className="font-heading text-3xl font-bold mb-6 text-foreground">What is a Medical Specialization?</h2>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        Medical specializations focus on specific parts of the body, age groups, or types of medical conditions.
                        Consulting a specialist ensures you get expert diagnosis and the most effective treatment plan tailored
                        to your specific health needs. At MediConnect, we bring all these experts to your fingertips.
                    </p>
                </div>
            </section>

            {/* Specializations Grid */}
            <section className="py-20 container">
                <div className="text-center mb-16">
                    <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">Popular Specializations</h2>
                    <p className="text-muted-foreground">Comprehensive care covering all major medical fields</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {specializations.map((spec, index) => (
                        <Card key={index} className="group hover:shadow-lg transition-all duration-300 border-none shadow-sm hover:-translate-y-1 bg-card">
                            <CardHeader>
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${spec.bg} group-hover:bg-opacity-80`}>
                                    <spec.icon className={`h-6 w-6 ${spec.color}`} />
                                </div>
                                <CardTitle className="font-heading text-xl">{spec.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription className="text-base">{spec.description}</CardDescription>
                                <Link to="/doctors" className="inline-flex items-center text-sm font-medium text-primary mt-4 hover:underline">
                                    Find {spec.title} <Search className="ml-1 h-3 w-3" />
                                </Link>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="text-center mt-12">
                    <Button variant="outline" size="lg" asChild>
                        <Link to="/doctors">View All Specializations</Link>
                    </Button>
                </div>
            </section>

            {/* How to Find a Doctor */}
            <section className="py-20 bg-muted/50">
                <div className="container">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="order-2 md:order-1">
                            <div className="grid grid-cols-1 gap-6">
                                {features.map((feature, index) => (
                                    <div key={index} className="flex gap-4 items-start">
                                        <div className="w-10 h-10 rounded-full bg-background shadow-sm flex items-center justify-center flex-shrink-0 text-primary">
                                            <feature.icon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-lg mb-1">{feature.title}</h3>
                                            <p className="text-muted-foreground">{feature.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="order-1 md:order-2">
                            <h2 className="font-heading text-3xl md:text-4xl font-bold mb-6">
                                Easy Access to <span className="text-primary">Medical Experts</span>
                            </h2>
                            <p className="text-lg text-muted-foreground mb-8">
                                Finding the right doctor shouldn't be a headache. With MediConnect, you can browse profiles, check qualifications,
                                view availability, and book appointments instantly.
                            </p>
                            <div className="bg-card p-6 rounded-2xl shadow-sm border">
                                <h3 className="font-semibold mb-4">3 Simple Steps:</h3>
                                <ol className="space-y-4">
                                    <li className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                                        <span>Search for a specialization or condition</span>
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                                        <span>Compare doctors based on reviews and profile</span>
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                                        <span>Book a video or in-clinic consultation</span>
                                    </li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 container text-center">
                <div className="bg-gradient-to-r from-primary/90 to-primary p-12 md:p-16 rounded-3xl text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 -mr-12 -mt-12 bg-white/10 rounded-full blur-2xl h-64 w-64 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 p-12 -ml-12 -mb-12 bg-black/10 rounded-full blur-2xl h-64 w-64 pointer-events-none"></div>

                    <div className="relative z-10 max-w-2xl mx-auto">
                        <h2 className="font-heading text-3xl md:text-4xl font-bold mb-6">Your Health is Our Priority</h2>
                        <p className="text-lg text-white/90 mb-8">
                            Don't delay your care. Connect with a verified specialist today and take the first step towards better health.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button size="lg" variant="secondary" className="font-semibold" asChild>
                                <Link to="/doctors">Find a Doctor Now</Link>
                            </Button>
                            <Button size="lg" variant="outline" className="bg-transparent text-white border-white hover:bg-white/10" asChild>
                                <Link to="/auth?mode=signup">Sign Up Free</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </section>
        </MainLayout>
    );
};

export default Specializations;
