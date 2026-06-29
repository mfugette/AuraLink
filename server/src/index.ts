import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { notifyRouter } from './routes/notify.route';
import { partsRouter } from './routes/parts.route';

dotenv.config();

const app = express();
const PORT = process.env['PORT'] ?? 3000;

app.use(cors({ origin: process.env['CLIENT_ORIGIN'] ?? 'http://localhost:4200' }));
app.use(express.json());

app.use('/api/notify', notifyRouter);
app.use('/api/parts', partsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`OpenOBD server running on http://localhost:${PORT}`);
});
