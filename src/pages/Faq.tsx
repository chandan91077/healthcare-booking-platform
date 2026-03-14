import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const faqs = [
  {
    question: "How do I book an appointment?",
    answer: "Open Find Doctors, select a doctor, choose slot and consultation type, then complete payment.",
  },
  {
    question: "When can patients start chat or video?",
    answer: "Chat and video become available based on appointment permissions and payment/confirmation status.",
  },
  {
    question: "How do doctors manage appointments?",
    answer: "Doctors can review upcoming appointments, update consultation flow, and manage video actions from dashboard pages.",
  },
];

export default function Faq() {
  return (
    <MainLayout>
      <section className="container py-12 md:py-16">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="font-heading text-3xl md:text-4xl font-bold">Frequently Asked Questions</h1>
            <p className="text-muted-foreground">Common questions for patients and doctors.</p>
          </div>

          <div className="space-y-4">
            {faqs.map((item) => (
              <Card key={item.question}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{item.question}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{item.answer}</CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </MainLayout>
  );
}