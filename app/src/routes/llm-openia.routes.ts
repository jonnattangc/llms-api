import { Router } from 'express';
import Request from 'express';
import Response from 'express';
const router = Router();

// Endpoint para obtener todos los productos
router.get('/', (req: Request, res: Response) => {
  res.send('Obteniendo todos los productos');
});

// Endpoint para obtener un producto por su ID
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  res.send(`Obteniendo el producto con ID: ${id}`);
});

export default router;