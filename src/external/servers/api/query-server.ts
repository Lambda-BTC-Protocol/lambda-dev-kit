import { OpenAPIHono } from "@hono/zod-openapi";
import { lambdaEngine } from "@core/lambda-engine.ts";
import { stringify } from "superjson";
import { z } from "zod";
import { logger } from "@core/logging.ts";

export const queryServer = new OpenAPIHono();

queryServer.get("/query", async (c) => {
  const args = c.req.query("args");
  const func = c.req.query("function");
  const contract = c.req.query("contract");
  if (!args) return c.text("no args", 404);
  if (!func) return c.text("no function", 404);
  if (!contract) return c.text("no contract", 404);
  const parsedArgs = JSON.parse(args) as Array<unknown>;
  logger.debug({ args, func, contract }, "query request");
  try {
    const result = await lambdaEngine.callQuery(contract, func, parsedArgs);
    const stringified = stringify(result);
    return c.text(stringified);
  } catch (e) {
    logger.error(e, "query error");
    return c.text("", 400);
  }
});

queryServer.post("/multi-query", async (c) => {
  const body = await c.req.json();
  if (!body) return new Response("no-body", { status: 404 });
  try {
    const querySchema = z.object({
      contract: z.string(),
      function: z.string(),
      args: z.array(z.unknown()),
    });
    const multiQuerySchema = z.array(querySchema);

    const queries = multiQuerySchema.parse(body);
    logger.debug(queries, "multiquery request");
    const result = await multiQuery(queries);
    const stringified = stringify(result);
    return new Response(stringified);
  } catch (e) {
    logger.error(e, "multiquery error");
    return new Response("", { status: 400 });
  }
});

export async function multiQuery(
  queries: { contract: string; function: string; args: unknown[] }[],
) {
  const result: Array<unknown> = [];
  for (const query of queries) {
    const res = await lambdaEngine.callQuery(
      query.contract,
      query.function,
      query.args,
    );
    result.push(res);
  }
  return result;
}
