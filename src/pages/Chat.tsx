import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format } from "date-fns";
import api from "@/lib/api";
import { uploadToS3 } from "@/lib/s3-upload";
import ChatControlBar from "@/components/ChatControlBar";
import {
  Send,
  ArrowLeft,
  Image as ImageIcon,
  Paperclip,
  Lock,
  Loader2,
  FileText,
} from "lucide-react";

interface Message {
  _id: string; // MongoDB uses _id
  id?: string; // For compatibility
  content: string | null;
  file_url: string | null;
  message_type: string;
  sender_id: string | any; // Can be ObjectId or populated user object
  created_at: string;
  is_read: boolean;
}

interface AppointmentDetails {
  _id: string;
  id?: string;
  appointment_date?: string;
  appointment_time?: string;
  chat_unlocked: boolean;
  video_unlocked: boolean;
  zoom_join_url: string | null;
  video: {
    provider: string;
    meetingId: string;
    doctorJoinUrl: string;
    patientJoinUrl: string;
    enabled: boolean;
    enabledAt: string | null;
  };
  doctor_id: any;
  patient_id: any;
  otherParty: {
    id: string;
    full_name: string;
    role: string;
  } | null;
}

export default function Chat() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading, isAuthenticated } = useAuthContext();

  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Video controls state
  const [zoomLink, setZoomLink] = useState<string>("");
  const [videoLoading, setVideoLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [authLoading, isAuthenticated, navigate]);

  const fetchAppointmentAndMessages = async () => {
    if (!appointmentId || !(user?._id || user?.id)) {
      // ensure we don't leave the skeleton spinner forever
      setLoading(false);
      return;
    }

    try {
      // Fetch appointment
      // Adapting to use the API which internally maps to MongoDB
      // For now we might need a specific endpoint or generic one.
      // Assuming GET /appointments/:id works or filtering
      // Since backend was just setup, we might not have a perfect /appointments/:id endpoint yet
      // but let's assume standard REST: api.get(`/appointments/${appointmentId}`)

      const { data: appt } = await api.get(`/appointments/${appointmentId}`);

      if (!appt) {
        toast.error("Appointment not found");
        navigate("/appointments");
        return;
      }

      // Check participation logic is handled by backend or mapped here.
      // For simplicity in this migration, we trust the backend to return the appt if allowed.

      // We need to fetch the "other party" details manually if the backend doesn't populate them
      let otherParty = null;
      let otherPartyId = role === 'patient' ? appt.doctor_id : appt.patient_id;

      // In MongoDB, these might be populated objects or IDs. 
      // If populated:
      if (typeof otherPartyId === 'object') {
        otherParty = {
          id: otherPartyId._id,
          full_name: role === 'patient' ? (otherPartyId.user_id?.full_name || "Doctor") : (otherPartyId.full_name || "Patient"),
          role: role === 'patient' ? 'doctor' : 'patient'
        };
      } else {
        // Fetch profile/doctor/user details if only ID
        // Simplified: just show "Dr. / Patient" if complex
        otherParty = {
          id: otherPartyId,
          full_name: role === 'patient' ? "Doctor" : "Patient",
          role: role === 'patient' ? 'doctor' : 'patient'
        }
      }

      setAppointment({
        ...appt,
        otherParty
      });

      // Fetch messages from all appointments in this conversation
      const { data: messagesData } = await api.get(`/messages/conversation?appointment_id=${appointmentId}`);
      setMessages(messagesData || []);

      // Mark other-party messages as read for the current user
      try {
        await api.put('/messages/mark-read', { appointment_id: appointmentId });
        setMessages((prev) => prev.map((m: any) => {
          const sid = typeof m.sender_id === 'object' ? (m.sender_id._id || m.sender_id) : m.sender_id;
          if (sid && sid !== (user?._id || user?.id)) return { ...m, is_read: true };
          return m;
        }));
      } catch (merr) {
        // ignore mark-read errors
        console.error('Failed to mark messages read', merr);
      }

      setLoading(false);

    } catch (error) {
      console.error("Error fetching chat:", error);
      // toast.error("Failed to load chat"); // Suppress initial load error to avoid spam if backend not ready
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && (user?._id || user?.id)) {
      fetchAppointmentAndMessages();
      // Setup polling instead of realtime for now
      const interval = setInterval(fetchAppointmentAndMessages, 5000); // Poll every 5s
      return () => clearInterval(interval);
    }
  }, [appointmentId, user, role, authLoading, navigate]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent, fileUrl?: string, fileType: 'text' | 'image' | 'file' = 'text') => {
    if (e) e.preventDefault();

    if ((!newMessage.trim() && !fileUrl) || !appointment || !(user?._id || user?.id)) return;

    // Extra client-side guard: patients cannot send when doctor has disabled chat
    if (role === 'patient' && appointment && !appointment.chat_unlocked) {
      toast.error('Chat is disabled by the doctor');
      setSending(false);
      return;
    }

    setSending(true);

    try {
      const messageData = {
        appointment_id: appointmentId,
        sender_id: user._id || user.id,
        content: newMessage.trim(),
        message_type: fileUrl ? fileType : "text",
        file_url: fileUrl || "",
        created_at: new Date().toISOString() // Optimistic update prep
      };

      const { data: savedMessage } = await api.post('/messages', messageData);

      setMessages((prev) => [...prev, savedMessage]);
      setNewMessage("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setSending(true);
    try {
      const url = await uploadToS3(file);
      if (url) {
        const type = file.type.startsWith('image/') ? 'image' : 'file';
        await handleSendMessage(undefined, url, type);
      } else {
        toast.error("Failed to upload file");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error uploading file");
    } finally {
      setSending(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  if (loading || authLoading) {
    return (
      <MainLayout>
        <div className="container py-8 max-w-4xl mx-auto">
          <Skeleton className="h-8 w-64 mb-8" />
          <Skeleton className="h-[600px]" />
        </div>
      </MainLayout>
    );
  }

  // Fallback if appointment failed to load or permission denied (handled in fetch usually)
  if (!appointment) return (
    <MainLayout>
      <div className="container py-8 max-w-4xl mx-auto">
        <p>Appointment not found or access denied.</p>
        <Button variant="link" asChild><Link to="/appointments">Go Back</Link></Button>
      </div>
    </MainLayout>
  );



  // Doctor toggle for chat
  const toggleChat = async () => {
    if (!appointment) return;
    try {
      const res = await api.put(`/appointments/${appointment._id}/permissions`, { chat_unlocked: !appointment.chat_unlocked });
      setAppointment((prev: any) => prev ? { ...prev, chat_unlocked: !prev.chat_unlocked } : prev);
      toast.success(`Chat ${appointment.chat_unlocked ? 'disabled' : 'enabled'}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to toggle chat');
    }
  };
  
  const generateVideoLink = () => {
    if (!appointment) return;
    setZoomLink(`https://zoom.us/j/${appointment._id.slice(-8)}`);
  };
  
  const enableVideo = async (send = true) => {
    if (!appointment || !zoomLink) {
      toast.error('Please enter or generate a video link');
      return;
    }
    try {
      setVideoLoading(true);
      await api.put(`/appointments/${appointment._id}/permissions`, { 
        video_unlocked: true, 
        zoom_join_url: zoomLink,
        auto_send: !!send
      });
      toast.success(send ? 'Video enabled and link sent' : 'Video enabled');
      await fetchAppointmentAndMessages();
    } catch (err) {
      console.error('Error enabling video', err);
      toast.error('Failed to enable video');
    } finally {
      setVideoLoading(false);
    }
  };
  
  const disableVideo = async () => {
    if (!appointment) return;
    try {
      setVideoLoading(true);
      await api.put(`/appointments/${appointment._id}/permissions`, { video_unlocked: false });
      toast.success('Video disabled');
      await fetchAppointmentAndMessages();
    } catch (err) {
      console.error('Error disabling video', err);
      toast.error('Failed to disable video');
    } finally {
      setVideoLoading(false);
    }
  };

  // No early return: allow read access even when chat is locked. Input will be disabled for patients if locked.


  return (
    <MainLayout>
      <div className="container py-8 max-w-4xl mx-auto">
        <Link
          to="/appointments"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to appointments
        </Link>

        <Card className="h-[calc(100vh-240px)] flex flex-col">
          <ChatControlBar
            appointment={appointment}
            otherParty={appointment.otherParty}
            userRole={role}
            onToggleChat={toggleChat}
            onGenerateVideo={generateVideoLink}
            onEnableVideo={() => enableVideo(true)}
            onDisableVideo={disableVideo}
            videoLoading={videoLoading}
            zoomLink={zoomLink}
            setZoomLink={setZoomLink}
            doctorName={appointment.doctor_id?.user_id?.full_name || "Dr. Doctor"}
            doctorSpecialization={appointment.doctor_id?.specialization || "Physician"}
          />

          {/* If patient and chat is locked, show read-only banner */}
          {role === 'patient' && !appointment.chat_unlocked && (
            <div className="p-3 bg-yellow-50 border-b border-yellow-200 text-yellow-800 flex items-center gap-3">
              <Lock className="h-5 w-5" />
              <div>
                <div className="font-medium">Chat is locked</div>
                <div className="text-sm text-muted-foreground">The doctor has disabled chat for this appointment; you can read messages but cannot send new ones.</div>
              </div>
            </div>
          )}

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No messages yet. Start the conversation!
                </p>
              ) : (
                messages.map((message) => {
                  const senderId = typeof message.sender_id === 'object' && message.sender_id ? (message.sender_id._id || message.sender_id) : message.sender_id;
                  const isOwn = senderId === (user?._id || user?.id); // compare with fallback _id or id
                  const senderName = typeof message.sender_id === 'object' && message.sender_id ? message.sender_id.full_name : null;
                  return (
                    <div
                      key={message._id || message.id}
                      className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2 ${isOwn
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                          }`}
                      >
                        {/* Sender name for incoming messages */}
                        {!isOwn && (
                          <div className="text-xs text-muted-foreground mb-1">{senderName || appointment?.otherParty?.full_name || 'Sender'}</div>
                        )}

                        {message.message_type === 'image' && message.file_url && (
                          <img src={message.file_url} alt="Shared image" className="max-w-full rounded mb-2" />
                        )}
                        {message.message_type === 'file' && message.file_url && (
                          <a href={message.file_url} target="_blank" rel="noreferrer" className="underline text-sm block mb-1">
                            View File
                          </a>
                        )}
                        {message.content && (
                          <p className={`break-words ${!isOwn && !message.is_read ? 'font-semibold' : ''}`}>{message.content}</p>
                        )}

                        <p
                          className={`text-xs mt-1 ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                            }`}
                        >
                          {message.created_at ? format(new Date(message.created_at), "h:mm a") : ""}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="border-t p-4 flex-shrink-0">
            <form onSubmit={(e) => handleSendMessage(e)} className="flex gap-2">
              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,.pdf"
              />

              <Button type="button" variant="ghost" size="icon" className="flex-shrink-0" onClick={triggerFileUpload} disabled={sending || (role === 'patient' && !appointment.chat_unlocked)}>
                <Paperclip className="h-5 w-5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="flex-shrink-0" onClick={triggerFileUpload} disabled={sending || (role === 'patient' && !appointment.chat_unlocked)}>
                <ImageIcon className="h-5 w-5" />
              </Button>
              <Input
                placeholder={role === 'patient' && !appointment.chat_unlocked ? 'Chat is read-only' : 'Type a message...'}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1"
                disabled={sending || (role === 'patient' && !appointment.chat_unlocked)}
              />
              <Button type="submit" size="icon" disabled={!newMessage.trim() || sending || (role === 'patient' && !appointment.chat_unlocked)}>
                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
