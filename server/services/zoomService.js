const axios = require('axios');

class ZoomService {
    constructor() {
        this.accountId = process.env.ZOOM_ACCOUNT_ID;
        this.clientId = process.env.ZOOM_CLIENT_ID;
        this.clientSecret = process.env.ZOOM_CLIENT_SECRET;
        this.baseURL = 'https://api.zoom.us/v2';
        this.token = null;
        this.tokenExpiry = null;
    }

    async getAccessToken() {
        try {
            // Check if we have a valid token
            if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
                return this.token;
            }

            const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

            const response = await axios.post('https://zoom.us/oauth/token', null, {
                params: {
                    grant_type: 'account_credentials',
                    account_id: this.accountId,
                },
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });

            this.token = response.data.access_token;
            // Token expires in 1 hour (3600 seconds), set expiry to 50 minutes from now for safety
            this.tokenExpiry = Date.now() + (50 * 60 * 1000);

            return this.token;
        } catch (error) {
            console.error('Error getting Zoom access token:', error.response?.data || error.message);
            throw new Error('Failed to authenticate with Zoom');
        }
    }

    async createMeeting(appointmentData) {
        try {
            const token = await this.getAccessToken();

            // For scheduled meetings, Zoom works best with a future start_time
            // Try to use appointment_date/time, but ensure it's valid
            let startTime = new Date();
            startTime.setMinutes(startTime.getMinutes() + 5); // At least 5 minutes in future
            
            if (appointmentData.appointment_date && appointmentData.appointment_time) {
                try {
                    const [hours, minutes] = appointmentData.appointment_time.split(':').map(Number);
                    const dateObj = new Date(appointmentData.appointment_date);
                    dateObj.setHours(hours, minutes, 0, 0);
                    
                    // Use appointment time if it's in the future, otherwise use 5 minutes from now
                    if (dateObj > new Date()) {
                        startTime = dateObj;
                    }
                } catch (e) {
                    console.warn('Could not parse appointment time, using 5 minutes from now');
                }
            }

            const meetingData = {
                topic: appointmentData.doctorName ? `Appointment with Dr. ${appointmentData.doctorName}` : `Appointment with MediConnect`,
                type: 2, // Scheduled meeting - allows both users to join independently
                start_time: startTime.toISOString(),
                duration: 60, // 60 minutes
                timezone: 'UTC',
                agenda: `Medical consultation appointment`,
                settings: {
                    host_video: true,
                    participant_video: true,
                    join_before_host: true, // Allow joining before host - CRITICAL for users to join independently
                    waiting_room: false, // No waiting room - users join directly
                    use_pmi: false,
                    approval_type: 0, // Auto approve all participants
                    audio: 'both',
                    auto_recording: 'none',
                    mute_upon_entry: false,
                    require_password_for_scheduling_new_meetings: false,
                    require_password_for_instant_meetings: false,
                    require_password_for_pmi_meetings: false,
                    allow_multiple_devices: true, // Allow multiple devices
                    meeting_authentication: false, // No authentication required
                    
                },
            };

            const response = await axios.post(`${this.baseURL}/users/me/meetings`, meetingData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const meeting = response.data;
            console.log('✅ Zoom meeting created successfully:', {
                meetingId: meeting.id,
                joinUrl: meeting.join_url,
                startTime: meeting.start_time,
                topic: meeting.topic,
            });

            // Use the actual join_url from Zoom API which allows joining without host
            // Both doctor and patient use the same link and can join independently
            const joinUrl = meeting.join_url || `https://zoom.us/j/${meeting.id}`;

            return {
                provider: 'zoom',
                meetingId: meeting.id.toString(),
                doctorJoinUrl: joinUrl, // Both use same join URL
                patientJoinUrl: joinUrl, // Both can join immediately
                enabled: false,
                enabledAt: null,
            };
        } catch (error) {
            console.error('❌ Error creating Zoom meeting:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
            });
            throw new Error('Failed to create Zoom meeting');
        }
    }

    async getMeeting(meetingId) {
        try {
            const token = await this.getAccessToken();

            const response = await axios.get(`${this.baseURL}/meetings/${meetingId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            return response.data;
        } catch (error) {
            console.error('Error getting Zoom meeting:', error.response?.data || error.message);
            throw new Error('Failed to get Zoom meeting details');
        }
    }
}

module.exports = new ZoomService();