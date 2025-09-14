import { generateContent } from '../services/gemini.service.ts';

import { Router } from 'express';
const router = Router();

// Endpoint para obtener todos los usuarios
router.get('/', (req: Request, res: Response) => {
  res.send('Obteniendo todos los usuarios');
});

// Endpoint para crear un nuevo usuario
router.post('/:model', async (req: Request, res: Response) => {
    const { prompt } = req.body;
    const { model} = req.params;

    if (!prompt) {
        return res.status(400).json({ error: 'El campo "prompt" es requerido.' });
    }

    try {
        const text = await generateContent(prompt, model);
        res.json({ result: text });
    } catch (error) {
        console.error('Error: ', error);
        res.status(500).json({ error: 'Error al generar el contenido.' });
    }

    // res.send('Creando un nuevo usuario');
});

export default router;

