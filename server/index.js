const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();
const { startAutoCancellationJob } = require('./utils/cron-jobs');

const app = express();

// Middleware
const configuredOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((url) => url.trim()).filter(Boolean)
    : [];

const defaultOrigins = ['http://localhost:8080', 'http://127.0.0.1:8080'];
const allowedOrigins = [...new Set([...configuredOrigins, ...defaultOrigins])];

const corsOptions = {
    origin: (origin, callback) => {
        // Allow non-browser requests (Postman/curl/server-side jobs)
        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).json({ message: 'HealthLink backend is running' });
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Database Connection
connectDB();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/availability', require('./routes/availability'));
app.use('/api/notifications', require('./routes/notifications'));

const PORT = process.env.PORT || 5000;

// Start server only if not running in test environment
if (!process.env.JEST_WORKER_ID) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        startAutoCancellationJob();
    });
}

module.exports = app;
