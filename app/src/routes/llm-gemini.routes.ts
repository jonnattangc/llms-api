import { Router } from 'express';

const router = Router();

// Endpoint para obtener todos los usuarios
router.get('/', (req: Request, res: Response) => {
  res.send('Obteniendo todos los usuarios');
});

// Endpoint para crear un nuevo usuario
router.post('/', (req: Request, res: Response) => {
  res.send('Creando un nuevo usuario');
});

export default router;

