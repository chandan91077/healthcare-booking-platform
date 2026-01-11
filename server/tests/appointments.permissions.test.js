const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
let app;

jest.setTimeout(30000);

describe('Appointments permissions and notifications flow', () => {
  let mongoServer;
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGO_URI = uri;
    // start the app
    app = require('../index');
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  test('doctor can enable video and notifications get created', async () => {
    // create patient and doctor users via auth API, then create doctor profile, then appointment
    const User = require('../models/User');
    const Doctor = require('../models/Doctor');
    const Appointment = require('../models/Appointment');
    const Notification = require('../models/Notification');

    // register patient
    const patientRes = await request(app).post('/api/auth/register').send({ full_name: 'Pat One', email: 'pat@example.com', password: 'secret' });
    expect(patientRes.status).toBe(201);
    const patient = await User.findOne({ email: 'pat@example.com' });

    // register doctor user
    const docRes = await request(app).post('/api/auth/register').send({ full_name: 'Doc One', email: 'doc@example.com', password: 'secret', role: 'doctor' });
    expect(docRes.status).toBe(201);
    const docToken = docRes.body.token;
    const docUser = await User.findOne({ email: 'doc@example.com' });

    // create doctor profile using auth token
    const createDoc = await request(app).post('/api/doctors').set('Authorization', `Bearer ${docToken}`).send({ user_id: docUser._id, specialization: 'Cardiology', experience_years: 5, consultation_fee: 500, is_verified: true });
    expect(createDoc.status).toBe(201);
    const doctor = await Doctor.findOne({ user_id: docUser._id });

    // create appointment
    const appt = await Appointment.create({ doctor_id: doctor._id, patient_id: patient._id, appointment_date: '2026-01-12', appointment_time: '10:00', amount: 500, status: 'confirmed', payment_status: 'paid' });

    // doctor enables video and auto_send
    const res = await request(app)
      .put(`/api/appointments/${appt._id}/permissions`)
      .set('Authorization', `Bearer ${docToken}`)
      .send({ video_unlocked: true, auto_send: true, zoom_join_url: 'https://zoom.us/j/testlink' });

    expect(res.status).toBe(200);
    const updated = await Appointment.findById(appt._id);
    expect(updated.video_unlocked).toBe(true);
    expect(updated.zoom_join_url).toBeTruthy();

    const patientNotifs = await Notification.find({ user_id: patient._id, type: 'video_link' });
    const doctorNotifs = await Notification.find({ user_id: docUser._id, type: 'video_link' });
    expect(patientNotifs.length).toBeGreaterThanOrEqual(1);
    expect(doctorNotifs.length).toBeGreaterThanOrEqual(1);
  });
});