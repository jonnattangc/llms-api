import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import apiRouter from './routes/index.ts'; 

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || 'localhost';

// congura CORS
const whitelist = ['https://dev.jonnattan.com', 'https://api.jonnattan.cl', 'http://localhost'];

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (whitelist.indexOf(origin || '') !== -1) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por politicas de CORS'));
    }
  },
};

app.use(express.json()); // Middleware para parsear JSON
app.use(cors(corsOptions));
// Usa el enrutador principal para manejar todas las rutas
app.use('/llm', apiRouter);


app.get('/', (req: Request, res: Response) => {
  res.send('¡Hola, mundo desde Express con TypeScript!');
});

app.listen(port, host, () => {
  console.log(`Servidor escuchando en http://${host}:${port}`);
});





