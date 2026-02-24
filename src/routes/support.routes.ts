import { Router } from 'express';
import {
  createTicket,
  getAllTickets,
  markAsRead,
  markAsUnread,
  deleteTicket
} from '../controllers/support.controller';
import { authenticateToken, authenticateAdminToken, requireAdminRole } from '../middleware/auth';
import { writeLimiter, readLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public/User route to submit contact form
// We use a middleware to extract user if token exists, or we can just make it mandatory if desired.
// For now, making it mandatory as per "we should take/check for token" to ensure tracking.
router.post('/contact', writeLimiter, authenticateToken, createTicket);

// Admin routes (Protected)
router.use(authenticateAdminToken);
router.use(requireAdminRole(['super_admin', 'admin']));

router.get('/tickets', readLimiter, getAllTickets);
router.patch('/tickets/:id/read', writeLimiter, markAsRead);
router.patch('/tickets/:id/unread', writeLimiter, markAsUnread);
router.delete('/tickets/:id', writeLimiter, deleteTicket);

export default router;
