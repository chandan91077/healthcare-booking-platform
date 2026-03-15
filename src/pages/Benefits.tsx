import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";

const benefits = [
  "Flexible consultation schedule",
  "Digital appointment and payment workflow",
  "Built-in chat and video consultation support",
  "Access to a growing patient network",
];

export default function Benefits() {
  const { isAuthenticated } = useAuthContext();

  return (
    <MainLayout>
      <section className="container py-12 md:py-16">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="font-heading text-3xl md:text-4xl font-bold">Benefits for Doctors</h1>
            <p className="text-muted-foreground">Why doctors join MediConnect.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Doctor Advantages</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                {benefits.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {!isAuthenticated && (
                <div className="mt-6">
                  <Button asChild>
                    <Link to="/auth?mode=signup&role=doctor">Join as Doctor</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </MainLayout>
  );
}