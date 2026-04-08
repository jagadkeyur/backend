const http = require("http");

const app = require("./app");
const connectDatabase = require("./config/database");
const env = require("./config/env");
const initializeSocketServer = require("./sockets");

async function bootstrap() {
  await connectDatabase();

  const server = http.createServer(app);
  initializeSocketServer(server);

  server.listen(env.port, () => {
    console.log(`API listening on port ${env.port} in ${env.nodeEnv} mode`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
