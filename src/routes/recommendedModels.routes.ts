import { Router } from 'express';
import {
  getRecommendedModels,
  getAllRecommendedModels,
  createRecommendedModel,
  bulkCreateRecommendedModels,
  updateRecommendedModel,
  deleteRecommendedModel,
} from '../controllers/recommendedModels.controller';
import { authenticateToken, authenticateAdminToken, requireAdminRole } from '../middleware/auth';
import { writeLimiter, readLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public/User route: Get only active recommended models
router.get('/', readLimiter, getRecommendedModels);

// Protected route: Get all models (including inactive) for Admin or Auth Users
router.get('/all', readLimiter, authenticateToken, getAllRecommendedModels);

// Admin routes: Manage recommended models
router.use(authenticateAdminToken);
router.use(requireAdminRole(['super_admin', 'admin']));

router.post('/', writeLimiter, createRecommendedModel);
router.post('/bulk', writeLimiter, bulkCreateRecommendedModels);
router.patch('/:id', writeLimiter, updateRecommendedModel);
router.delete('/:id', writeLimiter, deleteRecommendedModel);

export default router;
