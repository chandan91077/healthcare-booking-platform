import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import React from 'react';
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AdminPage from "./pages/AdminPage";
import Dashboard from "./pages/Dashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import DoctorRegister from "./pages/DoctorRegister";
import DoctorProfile from "./pages/DoctorProfile";
import AdminDashboard from "./pages/AdminDashboard";
import Doctors from "./pages/Doctors";
import BookAppointment from "./pages/BookAppointment";
import Payment from "./pages/Payment";
import Appointments from "./pages/Appointments";
import Chat from "./pages/Chat";
import Prescriptions from "./pages/Prescriptions";
import NotificationsPage from "./pages/Notifications";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Specializations from "./pages/Specializations";
import AboutUs from "./pages/AboutUs";
import PastAppointments from "./pages/PastAppointments";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
            <Route path="/doctor/:doctorId" element={/* lazy mount */ <React.Suspense fallback={<div />}><DoctorProfile /></React.Suspense>} />
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
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;