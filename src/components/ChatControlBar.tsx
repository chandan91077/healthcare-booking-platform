import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PrescriptionModal } from "@/components/PrescriptionModal";
import { PatientHistoryModal } from "@/components/PatientHistoryModal";
import {
  Video,
  Loader2,
  MessageSquare,
  Copy,
  Check,
  CheckCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ChatControlBarProps {
  appointment: {
    _id: string;
    patient_id: any;
    doctor_id: any;
    appointment_date?: string;
    appointment_time?: string;
    status?: string;
    chat_unlocked: boolean;
    video_unlocked: boolean;
    zoom_join_url?: string;
  };
  otherParty: {
    id: string;
    full_name: string;
    role: string;
  } | null;
  userRole: string;
  onToggleChat: () => Promise<void>;
  onGenerateVideo: () => void;
  onEnableVideo: () => Promise<void>;
  onDisableVideo: () => Promise<void>;
  onMarkDone: () => Promise<void>;
  videoLoading: boolean;
  zoomLink: string;
  setZoomLink: (link: string) => void;
  doctorName: string;
  doctorSpecialization: string;
}

export default function ChatControlBar({
  appointment,
  otherParty,
  userRole,
  onToggleChat,
  onGenerateVideo,
  onEnableVideo,
  onDisableVideo,
  onMarkDone,
  videoLoading,
  zoomLink,
  setZoomLink,
  doctorName,
  doctorSpecialization,
}: ChatControlBarProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [togglingChat, setTogglingChat] = useState(false);
  const [markingDone, setMarkingDone] = useState(false);

  const patientId = typeof appointment.patient_id === 'object' ? appointment.patient_id._id : appointment.patient_id;
  const doctorId = typeof appointment.doctor_id === 'object' ? appointment.doctor_id._id : appointment.doctor_id;
  
  const handleToggleChat = async () => {
    setTogglingChat(true);
    try {
      await onToggleChat();
    } finally {
      setTogglingChat(false);
    }
  };

  const handleCopyLink = () => {
    if (zoomLink) {
      navigator.clipboard.writeText(zoomLink);
      setCopiedLink(true);
      toast.success("Video link copied to clipboard");
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleJoinVideo = () => {
    if (zoomLink) {
      window.open(zoomLink, '_blank', 'noopener,noreferrer');
    }
  };

  const handleMarkDone = async () => {
    // Confirm before marking as done
    if (!confirm('Mark this appointment as completed? The patient will receive an email with consultation details and prescription.')) {
      return;
    }
    
    setMarkingDone(true);
    try {
      await onMarkDone();
    } finally {
      setMarkingDone(false);
    }
  };

  return (
    <div className="border-b bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        {/* Left side: Patient info */}
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback className="bg-primary/10 text-primary">
              {otherParty?.full_name?.charAt(0) || "P"}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-sm">
              {otherParty?.role === "doctor" ? "Dr. " : ""}
              {otherParty?.full_name}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {otherParty?.role}
            </p>
          </div>
        </div>

        {/* Right side: Doctor controls */}
        {userRole === 'doctor' && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Prescribe Button */}
            <PrescriptionModal
              appointmentId={appointment._id}
              patientId={patientId}
              patientName={otherParty?.full_name || "Patient"}
              doctorId={doctorId}
              doctorName={doctorName}
              doctorSpecialization={doctorSpecialization}
            />

            {/* View History Button */}
            <PatientHistoryModal
              patientId={patientId}
              patientName={otherParty?.full_name || "Patient"}
            />

            {/* Chat Toggle */}
            <Button
              size="sm"
              onClick={handleToggleChat}
              disabled={togglingChat}
              className={appointment.chat_unlocked ? "bg-red-600 hover:bg-red-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"}
            >
              {togglingChat ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <MessageSquare className="h-4 w-4 mr-1" />
              )}
              {appointment.chat_unlocked ? 'Disable Chat' : 'Enable Chat'}
            </Button>

            {/* Video Controls Section */}
            {!appointment.video_unlocked ? (
              <div className="flex items-center gap-1">
                <Input
                  value={zoomLink}
                  onChange={(e) => setZoomLink(e.target.value)}
                  placeholder="Enter/generate video link"
                  className="h-8 text-xs w-40"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onGenerateVideo}
                  disabled={videoLoading}
                >
                  Generate
                </Button>
                <Button
                  size="sm"
                  onClick={onEnableVideo}
                  disabled={videoLoading || !zoomLink.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {videoLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Enable Video
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {/* Display current video link */}
                <div className="flex items-center gap-1 bg-muted rounded px-2 py-1 text-xs max-w-xs">
                  <span className="truncate">{appointment.zoom_join_url || 'Video link'}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={handleCopyLink}
                  >
                    {copiedLink ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleJoinVideo}
                >
                  <Video className="h-4 w-4 mr-1" />
                  Join Video
                </Button>

                <Button
                  size="sm"
                  onClick={onDisableVideo}
                  disabled={videoLoading}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Disable Video
                </Button>
              </div>
            )}

            {/* Mark as Done Button */}
            {appointment.status !== 'completed' && (
              <Button
                size="sm"
                onClick={handleMarkDone}
                disabled={markingDone}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {markingDone ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                Mark as Done
              </Button>
            )}
          </div>
        )}

        {/* Patient view: Show join video button if enabled */}
        {userRole === 'patient' && appointment.video_unlocked && appointment.zoom_join_url && (
          <Button
            size="sm"
            variant="secondary"
            onClick={handleJoinVideo}
          >
            <Video className="h-4 w-4 mr-1" />
            Join Video
          </Button>
        )}
      </div>
    </div>
  );
}
