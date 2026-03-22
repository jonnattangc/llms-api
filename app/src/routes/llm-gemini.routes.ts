import { generateContent } from '../services/gemini.service.ts';
import Request from 'express';
import Response from 'express';
import { Router } from 'express';

const router = Router();

// Endpoint para obtener todos los usuarios
router.get('/', (req: Request, res: Response) => {
  res.send('Obteniendo todos los usuarios');
});

// Endpoint para crear un nuevo usuario
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

    // res.send('Creando un nuevo usuario');
});

export default router;

