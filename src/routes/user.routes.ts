import { Router } from 'express';
import {
  getUsersDirectory,
  getUserProfileById,
} from '../controllers/user.controller';
import { optionalAuth } from '../middlewares/auth.middleware';

const router = Router();

// Public / Member Directory (uses optionalAuth so caller's role determines field visibility)
router.get('/', optionalAuth, getUsersDirectory);
router.get('/directory', optionalAuth, getUsersDirectory);
router.get('/:id', optionalAuth, getUserProfileById);

export default router;
