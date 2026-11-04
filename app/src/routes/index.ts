import express from 'express';
import llmRouter from './llm.routes.ts';
import ragRouter from './rag.routes.ts';

const router = express.Router();

router.use('/llm', llmRouter);
router.use('/rag', ragRouter);

export default router;
