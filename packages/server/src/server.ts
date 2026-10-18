import dotenv from 'dotenv';
dotenv.config();

import { initDatabase, closeDatabase } from './db/index.js';
import { createApp } from './app.js';
import { GameSimulation } from './simulation/GameSimulation.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

async function bootstrap() {
  try {
    console.log('[Server] Inicializando banco de dados...');
    const db = await initDatabase();
    console.log('[Server] Banco de dados pronto e migrações aplicadas.');

    const simulation = new GameSimulation();
    simulation.start();
    console.log('[Server] Motor de Simulação Autoritativa iniciado a 20 Hz (50ms).');

    const app = createApp(db, simulation);

    const server = app.listen(PORT, () => {
      console.log(`[Server] NoobRPG Server rodando em http://localhost:${PORT}`);
    });

    const shutdown = async () => {
      console.log('\n[Server] Encerrando servidor graciosamente...');
      simulation.stop();
      server.close(async () => {
        await closeDatabase();
        console.log('[Server] Recursos liberados.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('[Server] Falha fatal na inicialização:', err);
    process.exit(1);
  }
}

bootstrap();
