import app from "./app";
import logger from "./util/logger";

const server = app.listen(app.get("port"), () => {
  console.log(
    " App is running at http://0.0.0.0:%d in %s mode",
    app.get("port"),
    app.get("env")
  );
  console.log(" Press CTRL+C to stop\n");
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, starting graceful shutdown...`);

  server.close(async () => {
    logger.info("HTTP server closed");

    // Give time for cleanup
    setTimeout(() => {
      logger.info("Graceful shutdown complete");
      process.exit(0);
    }, 5000);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default server;
