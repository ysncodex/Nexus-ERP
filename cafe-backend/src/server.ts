import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';

async function main() {
  // Verify the database connection before accepting traffic.
  await prisma.$connect();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    if (env.NODE_ENV !== 'production') {
      console.log(`Cafe ERP API listening on http://localhost:${env.PORT}`);
      console.log(`Health: http://localhost:${env.PORT}/api/health`);
    }
  });

  const shutdown = async (signal: string) => {
    if (env.NODE_ENV !== 'production') {
      console.log(`${signal} received — shutting down gracefully...`);
    }
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  // Node exits on an unhandled rejection by default. A single failed
  // background promise (a stray `void fetch(...)`, a catalog write, a logging
  // call) should not take the whole API down and drop in-flight requests, so
  // log it loudly and keep serving. Express 5 already routes rejected request
  // handlers to the error middleware, so anything arriving here is a real bug
  // worth reading in the logs.
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection (server kept running):', reason);
  });

  // An uncaught exception leaves the process in an unknown state, so the safe
  // move is to log and let the platform restart it cleanly.
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception — exiting for a clean restart:', error);
    server.close();
    void prisma.$disconnect().finally(() => process.exit(1));
  });
}

main().catch(async (err) => {
  console.error('Fatal startup error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
