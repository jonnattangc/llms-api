import express from 'express';
import geminiRouter from './llm-gemini.routes.ts';
import openaiRouter from './llm-openai.routes.ts';
import kimiRouter from './llm-kimi.routes.ts';
import deepseekRouter from './llm-deepseek.routes.ts';

const router = express.Router();

router.use('/gemini', geminiRouter);
router.use('/openai', openaiRouter);
router.use('/kimi', kimiRouter);
router.use('/deepseek', deepseekRouter);

export default router;
