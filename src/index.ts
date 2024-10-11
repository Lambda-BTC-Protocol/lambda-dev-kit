import { demoServer } from "@external/servers/demo-server.ts";
import { apiServer } from "@external/servers/api/api-server.ts";
import { registerSuperJSON } from "@contracts/utils/superjson-recipes.ts";
import { env } from "./env.ts";
import { serve } from "bun";
import { logger } from "@core/logging.ts";
import { develop } from "./develop.ts";

registerSuperJSON();

// serve api
serve({
  fetch: apiServer.fetch,
  port: 4000,
});
logger.info(`🦊 API-Server is running at PORT 4000`);

if (env.NODE_ENV === "development") {
  logger.info(`🦊 Demo-Server is running at PORT ${demoServer.server?.port}`);
}

await develop();
