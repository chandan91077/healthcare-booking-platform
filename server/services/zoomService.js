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

            const meetingData = {
                topic: `Appointment with ${appointmentData.patientName}`,
                type: 2, // Scheduled meeting
                start_time: `${appointmentData.appointment_date}T${appointmentData.appointment_time}:00Z`,
                duration: 60, // 60 minutes
                timezone: 'UTC',
                agenda: `Medical consultation appointment`,
                settings: {
                    host_video: true,
                    participant_video: true,
                    join_before_host: false, // Doctor must join first
                    waiting_room: true, // Enable waiting room
                    use_pmi: false, // Don't use personal meeting ID
                    approval_type: 0, // Automatically approve
                    audio: 'both', // Both telephone and computer audio
                    auto_recording: 'none', // No auto recording
                    mute_upon_entry: true, // Mute participants when they join
                },
            };

            const response = await axios.post(`${this.baseURL}/users/me/meetings`, meetingData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const meeting = response.data;

            return {
                provider: 'zoom',
                meetingId: meeting.id.toString(),
                doctorJoinUrl: meeting.start_url,
                patientJoinUrl: meeting.join_url,
                enabled: false,
                enabledAt: null,
            };
        } catch (error) {
            console.error('Error creating Zoom meeting:', error.response?.data || error.message);
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