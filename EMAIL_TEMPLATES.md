# Email Templates Documentation

## Doctor Registration Flow Email Templates

This document describes the email templates used for the doctor registration workflow.

### 1. Registration Confirmation Email
**Template Files:**
- `server/email/templates/en/doctor_registration.html`
- `server/email/templates/en/doctor_registration.txt`

**When Sent:** Immediately after a doctor completes registration via POST `/api/doctors`

**Subject:** "Registration Received - MediConnect"

**Template Variables:**
```javascript
{
  doctorName: string,        // Full name of the doctor (from User model)
  email: string,             // Doctor's email address
  specialization: string,    // Medical specialization
  experienceYears: number,   // Years of experience
  state: string,             // Practice location/state
  dashboardUrl: string       // Link to doctor dashboard
}
```

**Purpose:** Confirms receipt of registration application and sets expectations for review process (24-48 hours).

---

### 2. Application Approved Email
**Template Files:**
- `server/email/templates/en/doctor_approved.html`
- `server/email/templates/en/doctor_approved.txt`

**When Sent:** When admin approves doctor application via PUT `/api/doctors/:id` with `verification_status: "approved"`

**Subject:** "✅ Application Approved - MediConnect"

**Template Variables:**
```javascript
{
  doctorName: string,        // Full name of the doctor
  email: string,             // Doctor's email address
  specialization: string,    // Medical specialization
  experienceYears: number,   // Years of experience
  consultationFee: number,   // Consultation fee amount
  emergencyFee: number,      // Emergency consultation fee
  state: string,             // Practice location/state
  dashboardUrl: string       // Link to doctor dashboard
}
```

**Purpose:** Congratulates doctor on approval and outlines what they can do next (set availability, accept appointments, manage consultations).

---

### 3. Application Rejected Email
**Template Files:**
- `server/email/templates/en/doctor_rejected.html`
- `server/email/templates/en/doctor_rejected.txt`

**When Sent:** When admin rejects doctor application via PUT `/api/doctors/:id` with `verification_status: "rejected"`

**Subject:** "Application Update - MediConnect"

**Template Variables:**
```javascript
{
  doctorName: string,        // Full name of the doctor
  email: string,             // Doctor's email address
  rejectionReason: string,   // Admin-provided reason for rejection
  dashboardUrl: string       // Link to resubmit application
}
```

**Purpose:** Empathetically informs doctor of rejection with specific reason and encourages reapplication after addressing concerns.

---

### 4. Consultation Completed Email (Existing)
**Template Files:**
- `server/email/templates/en/consultation_completed.html`
- `server/email/templates/en/consultation_completed.txt`

**When Sent:** When doctor marks appointment as done via POST `/api/appointments/:id/mark-done`

**Subject:** "Consultation Completed - MediConnect"

**Template Variables:**
```javascript
{
  patientName: string,       // Patient's full name
  doctorName: string,        // Doctor's full name
  appointmentDate: string,   // Formatted appointment date
  hasPrescription: boolean,  // Whether prescription was issued
  medications: Array<{       // Array of prescribed medications
    name: string,
    dosage: string,
    frequency: string,
    duration: string,
    instructions: string
  }>,
  prescriptionPdfUrl: string, // Link to prescription PDF
  dashboardUrl: string        // Link to patient dashboard
}
```

**Purpose:** Notifies patient of completed consultation with prescription details if applicable.

---

## Implementation Details

### Backend Integration
All emails are sent automatically by the backend:

1. **Registration Email** - Triggered in `server/routes/doctors.js` POST `/` endpoint
2. **Approval/Rejection Emails** - Triggered in `server/routes/doctors.js` PUT `/:id` endpoint when `verification_status` changes
3. **Consultation Completed Email** - Triggered in `server/routes/appointments.js` POST `/:id/mark-done` endpoint

### Email Service Configuration
Emails are sent using Gmail SMTP configured in `server/.env`:
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=chandany67071@gmail.com
SMTP_PASS=jymszilufjvutxcj
```

### Template Rendering
Templates use custom `renderTemplate` utility supporting:
- `{{variable}}` - Variable substitution
- `{{#if condition}}...{{/if}}` - Conditional blocks
- `{{#each array}}...{{/each}}` - Array iteration

### Error Handling
Email sending is wrapped in try-catch blocks to prevent registration/approval failures if email service is down. Errors are logged to console but don't block the operation.

---

## Testing Email Flow

### Test Registration Email
1. Register as a new doctor via `/doctor/register`
2. Check email inbox for "Registration Received - MediConnect"

### Test Approval Email
1. Login as admin at `/admin`
2. Click "Approve" on a pending doctor application
3. Doctor should receive "Application Approved - MediConnect"

### Test Rejection Email
1. Login as admin at `/admin`
2. Click "Reject" on a pending doctor application
3. Enter rejection reason
4. Doctor should receive "Application Update - MediConnect" with reason

### Test Consultation Email
1. Doctor marks appointment as done in chat
2. Patient receives "Consultation Completed - MediConnect"

---

## Email Template Design Guidelines

All templates follow consistent design:
- **Header:** Gradient background with title and recipient name
- **Content:** White background with clear sections
- **CTA Button:** Green button for primary action
- **Footer:** Gray background with company info and support contact
- **Responsive:** Works on mobile and desktop email clients
- **Plain Text Version:** Included for all templates for email clients that don't support HTML

---

## Support Contact
For email-related issues, contact: support@mediconnect.com
