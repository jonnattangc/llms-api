import express from 'express';
import { generateContent, listModels } from '../controllers/llm.controller.ts';

// Mismas rutas para todos los proveedores: /llm/<provider> y /llm/<provider>/<model>.
const router = express.Router();

router.get('/:provider', listModels);
router.post('/:provider/:model', generateContent);

export default router;
