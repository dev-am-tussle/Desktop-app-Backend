// ============================================
// CENTRALIZED ROUTES EXPORT
// ============================================
// All routes are mounted from this single file

import { Router } from 'express';
import authRoutes from './auth.routes';
import usersRoutes from './users.routes';
import adminRoutes from './admin.routes';
import subscriptionsRoutes from './subscriptions.routes';
import publicRoutes from './public.routes';
import dashboardRoutes from './dashboard.routes';
import licensesRoutes from './licenses.routes';
import modelsRoutes from './models.routes';
import auditLogsRoutes from './auditLogs.routes';
import paymentsRoutes from './payments.routes';
// Note: webhookRoutes mounted separately in server.ts before JSON parser

const router = Router();

// Health check endpoint
router.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: 'MongoDB',
    version: '1.0.0',
  });
});

// Mount all routes
router.use('/auth', authRoutes); // Public user authentication routes
router.use('/users', usersRoutes); // User management routes
router.use('/admin', adminRoutes); // Admin authentication and management routes
router.use('/subscriptions', subscriptionsRoutes); // Subscription management routes
router.use('/licenses', licensesRoutes); // License management routes
router.use('/models', modelsRoutes); // Model management routes
router.use('/audit-logs', auditLogsRoutes); // Audit logs routes
router.use('/payments', paymentsRoutes); // Payment management routes
// Note: /webhook routes mounted separately in server.ts (before JSON parser for raw body)
router.use('/public', publicRoutes); // Public desktop app routes
router.use('/dashboard', dashboardRoutes); // Dashboard analytics routes

export default router;
