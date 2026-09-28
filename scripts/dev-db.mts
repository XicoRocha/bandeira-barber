// Postgres local para desenvolvimento (PGlite), sem Docker nem instalação.
// Uso: npm run db:dev  →  DATABASE_URL=postgres://postgres@127.0.0.1:5433/postgres
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const port = Number(process.env.DEV_DB_PORT ?? 5433);
const db = await PGlite.create({ dataDir: "./.dev-db", extensions: { btree_gist } });
const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 20 });
await server.start();
console.log(`Base de dados local em postgres://postgres@127.0.0.1:${port}/postgres`);

process.on("SIGINT", async () => {
  await server.stop();
  await db.close();
  process.exit(0);
});
