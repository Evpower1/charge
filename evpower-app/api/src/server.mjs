import { buildApp } from './app.mjs';

const app = await buildApp();
const port = Number(process.env.PORT || 4100);
const host = process.env.HOST || '127.0.0.1';
await app.listen({ port, host });
console.log('Evpower mobile API listening on ' + host + ':' + port);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
  await app.close();
  process.exit(0);
});
