import { generateContent } from '../services/openai.service.ts';
import { Router } from 'express';
import Request from 'express';
import Response from 'express';
const router = Router();

// Endpoint para obtener todos los productos
router.post('/:model', async (req: Request, res: Response) => {
  const { type, data } = req.body;
  const { model } = req.params;
  console.log('Datos recibidos: ', data );
    if (!data || !data.prompt) {
        return res.status(400).json({ error: 'El campo "prompt" es requerido.' });
    }
    const prompt = data.prompt;
    if (type && type === 'encripted') { 
        // Aquí puedes agregar la lógica para desencriptar el prompt si es necesario
    } 

    try {
        const text = await generateContent(prompt, model);
        console.log('Contenido generado: ', text);
        res.json({ result: text });
    } catch (error) {
        console.error('Error: ', error);
        res.status(500).json({ error: 'Error al generar el contenido.' });
    }
});

export default router;