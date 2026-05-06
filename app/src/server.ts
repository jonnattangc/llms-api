import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import type { CorsOptions } from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/index.ts';

dotenv.config();

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const host = process.env.HOST || 'localhost';

const whitelist = ['https://dev.jonnattan.com', 'https://api.jonnattan.cl', 'https://api.jonna.cl'];

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (whitelist.indexOf(origin || '') !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por politicas de CORS'));
    }
  },
};

app.use(express.json());
app.use(cors(corsOptions));
app.use('/llm', apiRouter);

app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', providers: ['gemini', 'openai', 'kimi', 'deepseek'] });
});

app.listen(port, host, () => {
  console.log(`Servidor escuchando en http://${host}:${port}`);
});
