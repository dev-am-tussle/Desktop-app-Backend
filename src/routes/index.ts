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
import providersRoutes from './providers.routes';
import chatRoutes from './chat.routes';
import entitlementsRoutes from './entitlements.routes';
import couponsRoutes from './coupons.routes';
import fxRatesRoutes from './fxRates.routes';
import supportRoutes from './support.routes';
import recommendedModelsRoutes from './recommendedModels.routes';
import notificationsRoutes from './notifications.routes';
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
router.use('/admin/fx-rates', fxRatesRoutes); // FX rates management routes (admin protected)
router.use('/fx-rates', fxRatesRoutes); // FX rates public endpoint (no auth required)
// Note: /webhook routes mounted separately in server.ts (before JSON parser for raw body)
router.use('/public', publicRoutes); // Public desktop app routes
router.use('/dashboard', dashboardRoutes); // Dashboard analytics routes
router.use('/support', supportRoutes); // Support ticket routes
router.use('/recommended-models', recommendedModelsRoutes); // Recommended models routes
router.use('/notifications', notificationsRoutes); // Notification routes
router.use('/providers', providersRoutes); // External API provider routes
router.use('/chat', chatRoutes); // Chat completion routes
router.use('/entitlements', entitlementsRoutes); // Entitlements management routes
router.use('/coupons', couponsRoutes); // Coupon redemption routes

export default router;
