import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import connectDatabase from './config/database';
import { detectRegion } from './middleware/regionDetection';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const API_PREFIX = process.env.API_PREFIX || '/api';

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());

// CORS Configuration - Support multiple origins
const allowedOrigins = process.env.FRONTEND_ORIGIN?.split(',').map(origin => origin.trim()) || ['http://localhost:5173'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ============================================
// STRIPE WEBHOOK - MUST BE BEFORE express.json()
// ============================================
// Stripe webhook needs raw body for signature verification
// Mount it before JSON parser to preserve raw body
import webhookRoutes from './routes/webhook.routes';
app.use(`${API_PREFIX}/webhook`, webhookRoutes);

// ============================================
// BODY PARSERS - After webhook route
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());
app.use(morgan('dev'));

// Debug middleware - log all requests
app.use((req, _res, next) => {
  console.log(`📍 ${req.method} ${req.path}`);
  next();
});

// ============================================
// REGION DETECTION - Detect user's country/currency from IP
// ============================================
app.use(detectRegion);

// ============================================
// ROUTES
// ============================================

app.get('/', (_req, res) => {
  res.json({
    message: 'Sovereign AI Admin Portal API',
    version: '1.0.0',
    status: 'running',
    database: 'MongoDB',
    endpoints: {
      health: `${API_PREFIX}/health`,
      users: `${API_PREFIX}/users`,
      subscriptions: `${API_PREFIX}/subscriptions`,
      payments: `${API_PREFIX}/payments`,
      licenses: `${API_PREFIX}/licenses`,
      models: `${API_PREFIX}/models`,
      auditLogs: `${API_PREFIX}/audit-logs`,
      dashboard: `${API_PREFIX}/dashboard`,
      providers: `${API_PREFIX}/providers`,
      chat: `${API_PREFIX}/chat`,
    },
  });
});

// Mount all other routes (webhook already mounted above)
app.use(API_PREFIX, routes);

// ============================================
// ERROR HANDLING
// ============================================

app.use(notFoundHandler);
app.use(errorHandler);

// ===========================================
// START SERVER
// ===========================================

const startServer = async () => {
  try {
    await connectDatabase();

    app.listen(PORT, () => {
      console.log('='.repeat(60));
      console.log('🚀 SOVEREIGN AI ADMIN PORTAL BACKEND');
      console.log('='.repeat(60));
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Server Port: ${PORT}`);
      console.log(`📡 API Base: http://localhost:${PORT}${API_PREFIX}`);
      console.log(`🏥 Health Check: http://localhost:${PORT}${API_PREFIX}/health`);
      console.log(`🗄️  Database: MongoDB (Connected)`);
      console.log('='.repeat(60));
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n⚠️ SIGTERM received: Shutting down gracefully...');
  const mongoose = require('mongoose');
  await mongoose.connection.close();
  console.log('✅ MongoDB connection closed');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n⚠️ SIGINT received: Shutting down gracefully...');
  const mongoose = require('mongoose');
  await mongoose.connection.close();
  console.log('✅ MongoDB connection closed');
  process.exit(0);
});

export default app;
