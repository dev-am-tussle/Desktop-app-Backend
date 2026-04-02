import { Router } from 'express';
import {
  createNotification,
  updateNotification,
  syncNotifications,
  markAsRead,
  dismissNotification,
  deleteNotification,
  listNotifications
} from '../controllers/notification.controller';
import { authenticateToken, authenticateAdminToken, requireAdminRole } from '../middleware/auth';
import { writeLimiter, readLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * APP ROUTES (Version-Based Polling)
 */
// Sync notifications using POST payload
router.post('/sync', readLimiter, authenticateToken, syncNotifications);

// Interaction tracking
router.patch('/:notificationId/read', writeLimiter, authenticateToken, markAsRead);
router.patch('/:notificationId/dismiss', writeLimiter, authenticateToken, dismissNotification);


/**
 * ADMIN ROUTES (CRUD & Version Control)
 */
router.use(authenticateAdminToken);
router.use(requireAdminRole(['super_admin', 'admin']));

// List all notifications with filters and stats
router.get('/', readLimiter, listNotifications);

// Create new notification (Draft by default)
router.post('/', writeLimiter, createNotification);

// Update and Publish (Version increment on activation)
router.put('/:id', writeLimiter, updateNotification);

// Delete notification
router.delete('/:id', writeLimiter, deleteNotification);

export default router;
