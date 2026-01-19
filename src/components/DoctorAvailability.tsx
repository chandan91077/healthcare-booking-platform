import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Clock, Save } from "lucide-react";

interface AvailabilitySlot {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

const DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, "0");
  return { value: `${hour}:00`, label: `${hour}:00` };
});

interface DoctorAvailabilityProps {
  doctorId: string;
}

export function DoctorAvailability({ doctorId }: DoctorAvailabilityProps) {
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAvailability();
  }, [doctorId]);

  const fetchAvailability = async () => {
    try {
      const { data } = await api.get(`/availability/${doctorId}`);

      // Initialize all days with default values if not present
      const existingDays = new Set(data?.map((d: any) => d.day_of_week) || []);
      const allDays: AvailabilitySlot[] = DAYS.map((day) => {
        const existing = data?.find((d: any) => d.day_of_week === day.value);
        if (existing) {
          return {
            id: existing._id, // Map mongo _id
            day_of_week: existing.day_of_week,
            start_time: existing.start_time,
            end_time: existing.end_time,
            is_available: existing.is_available,
          };
        }
        return {
          day_of_week: day.value,
          start_time: "09:00",
          end_time: "17:00",
          is_available: day.value !== 0 && day.value !== 6, // Weekdays enabled by default
        };
      });

      setAvailability(allDays);
    } catch (error: any) {
      toast.error("Failed to load availability");
    } finally {
      setLoading(false);
    }
  };

  const updateSlot = (dayOfWeek: number, field: keyof AvailabilitySlot, value: any) => {
    setAvailability((prev) =>
      prev.map((slot) =>
        slot.day_of_week === dayOfWeek ? { ...slot, [field]: value } : slot
      )
    );
  };

  const saveAvailability = async () => {
    setSaving(true);
    try {
      for (const slot of availability) {
        if (slot.id) {
          // Update existing
          await api.put(`/availability/${slot.id}`, {
            start_time: slot.start_time,
            end_time: slot.end_time,
            is_available: slot.is_available,
          });
        } else {
          // Insert new
          await api.post('/availability', {
            doctor_id: doctorId,
            day_of_week: slot.day_of_week,
            start_time: slot.start_time,
            end_time: slot.end_time,
            is_available: slot.is_available,
          });
        }
      }

      toast.success("Availability saved successfully!");
      fetchAvailability(); // Refresh to get IDs for new records
    } catch (error: any) {
      toast.error(error.message || "Failed to save availability");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3 sm:pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Clock className="h-4 sm:h-5 w-4 sm:w-5" />
              Availability Schedule
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              Set your available hours for each day
            </CardDescription>
          </div>
          <Button onClick={saveAvailability} disabled={saving} className="text-xs sm:text-sm w-full sm:w-auto">
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 sm:space-y-4">
          {availability.map((slot) => {
            const day = DAYS.find((d) => d.value === slot.day_of_week);
            return (
              <div
                key={slot.day_of_week}
                className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border transition-colors ${slot.is_available ? "bg-background" : "bg-muted/50"}`}
              >
                <div className="w-20 sm:w-28 flex-shrink-0">
                  <Label className="font-medium text-sm sm:text-base">{day?.label}</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={slot.is_available}
                    onCheckedChange={(checked) =>
                      updateSlot(slot.day_of_week, "is_available", checked)
                    }
                  />
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {slot.is_available ? "Available" : "Unavailable"}
                  </span>
                </div>

                {slot.is_available && (
                  <div className="flex items-center gap-1 sm:gap-2 ml-0 sm:ml-auto flex-wrap">
                    <Select
                      value={slot.start_time}
                      onValueChange={(value) =>
                        updateSlot(slot.day_of_week, "start_time", value)
                      }
                    >
                      <SelectTrigger className="w-20 sm:w-24 text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_SLOTS.map((time) => (
                          <SelectItem key={time.value} value={time.value}>
                            {time.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <span className="text-xs sm:text-sm text-muted-foreground">to</span>

                    <Select
                      value={slot.end_time}
                      onValueChange={(value) =>
                        updateSlot(slot.day_of_week, "end_time", value)
                      }
                    >
                      <SelectTrigger className="w-20 sm:w-24 text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_SLOTS.map((time) => (
                          <SelectItem key={time.value} value={time.value}>
                            {time.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
