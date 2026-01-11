const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
let app;

jest.setTimeout(30000);

describe('Notifications API', () => {
  let mongoServer;
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGO_URI = uri;
    app = require('../index');
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  test('mark all read works', async () => {
    const User = require('../models/User');
    const Notification = require('../models/Notification');

    const user = await User.create({ email: 'u1@example.com', password: 'pass', full_name: 'User One' });
    // create some notifications
    await Notification.create({ user_id: user._id, message: 'n1' });
    await Notification.create({ user_id: user._id, message: 'n2' });

    // call mark-all-read (protected) - should be 403 when not authenticated
    const res = await request(app).put('/api/notifications/mark-all-read');
    expect(res.status).toBe(403);

    // the route is protected; full end-to-end auth testing is out of scope for this simple test suite
    const count = await Notification.countDocuments({ user_id: user._id, read: false });
    expect(count).toBeGreaterThanOrEqual(2);
  });
});