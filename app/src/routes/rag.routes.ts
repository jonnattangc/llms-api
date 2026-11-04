import express from 'express';
import { reload } from '../controllers/rag.controller.ts';

const router = express.Router();

router.post('/reload', reload);

export default router;
