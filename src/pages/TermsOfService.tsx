import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsOfService() {
  return (
    <MainLayout>
      <section className="container py-12 md:py-16">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="font-heading text-3xl md:text-4xl font-bold">Terms of Service</h1>
            <p className="text-muted-foreground">Usage terms for patients, doctors, and platform access.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Platform Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Users must provide accurate profile and appointment details.</p>
              <p>Doctors are responsible for maintaining valid credentials and professional conduct.</p>
              <p>Payments, cancellations, and consultation access follow appointment status and platform policies.</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </MainLayout>
  );
}