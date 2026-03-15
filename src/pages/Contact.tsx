import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MapPin, Phone } from "lucide-react";

export default function Contact() {
  return (
    <MainLayout>
      <section className="container py-12 md:py-16">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="font-heading text-3xl md:text-4xl font-bold">Contact Us</h1>
            <p className="text-muted-foreground">
              Reach our support team for patient and doctor assistance.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Email
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">chandany67071@gmail.com</CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Phone
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">9682000334</CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Office
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">123 Healthcare Ave, Medical City</CardContent>
            </Card>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}