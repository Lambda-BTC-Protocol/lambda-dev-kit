import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import * as process from "node:process";

export const env = createEnv({
  server: {
    NODE_ENV: z.union([z.literal("development"), z.literal("production")]),
    PINO_LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace"])
      .optional(),
  },
  runtimeEnv: process.env,
});
