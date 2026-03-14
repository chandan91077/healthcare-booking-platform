import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPolicy() {
  return (
    <MainLayout>
      <section className="container py-12 md:py-16">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="font-heading text-3xl md:text-4xl font-bold">Privacy Policy</h1>
            <p className="text-muted-foreground">How MediConnect handles patient and doctor data.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Information We Store</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>We store account details, appointment records, messages, and payment references required to provide healthcare services.</p>
              <p>Medical information is accessible only to authorized users involved in the consultation flow.</p>
              <p>Security controls include authenticated access and protected API endpoints.</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </MainLayout>
  );
}