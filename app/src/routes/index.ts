import { Router } from 'express';

import geminiRouter from './llm-gemini.routes.ts';
import openiaRouter from './llm-openia.routes.ts';

const router = Router();

// Asocia los enrutadores con sus prefijos de ruta base
router.use('/gemini', geminiRouter);
router.use('/openia', openiaRouter);

export default router;