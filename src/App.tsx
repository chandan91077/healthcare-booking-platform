import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import React from 'react';

const Index = React.lazy(() => import("./pages/Index"));
const Auth = React.lazy(() => import("./pages/Auth"));
const AdminPage = React.lazy(() => import("./pages/AdminPage"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const DoctorDashboard = React.lazy(() => import("./pages/DoctorDashboard"));
const DoctorRegister = React.lazy(() => import("./pages/DoctorRegister"));
const DoctorProfile = React.lazy(() => import("./pages/DoctorProfile"));
const AdminDashboard = React.lazy(() => import("./pages/AdminDashboard"));
const Doctors = React.lazy(() => import("./pages/Doctors"));
const BookAppointment = React.lazy(() => import("./pages/BookAppointment"));
const Payment = React.lazy(() => import("./pages/Payment"));
const Appointments = React.lazy(() => import("./pages/Appointments"));
const Chat = React.lazy(() => import("./pages/Chat"));
const Prescriptions = React.lazy(() => import("./pages/Prescriptions"));
const NotificationsPage = React.lazy(() => import("./pages/Notifications"));
const Settings = React.lazy(() => import("./pages/Settings"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const Specializations = React.lazy(() => import("./pages/Specializations"));
const AboutUs = React.lazy(() => import("./pages/AboutUs"));
const PastAppointments = React.lazy(() => import("./pages/PastAppointments"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AuthProvider>
          <React.Suspense fallback={<div />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/adminpage" element={<AdminPage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/doctor" element={<DoctorDashboard />} />
              <Route path="/doctor/register" element={<DoctorRegister />} />
              <Route path="/doctor/past-appointments" element={<PastAppointments />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/doctors" element={<Doctors />} />
              <Route path="/book/:doctorId" element={<BookAppointment />} />
              <Route path="/doctor/:doctorId" element={<DoctorProfile />} />
              <Route path="/payment/:appointmentId" element={<Payment />} />
              <Route path="/appointments" element={<Appointments />} />
              <Route path="/chat/:appointmentId" element={<Chat />} />
              <Route path="/prescriptions" element={<Prescriptions />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/specializations" element={<Specializations />} />
              <Route path="/about" element={<AboutUs />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </React.Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;