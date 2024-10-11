import { registerSuperJSON } from "@contracts/utils/superjson-recipes.ts";
import { cors } from "hono/cors";
import { OpenAPIHono } from "@hono/zod-openapi";
import { Routes } from "../openapi.ts";
import { swaggerUI } from "@hono/swagger-ui";
import { multiQuery, queryServer } from "@external/servers/api/query-server.ts";
import {
  contractServer,
  getAllTokenContractNames,
} from "@external/servers/api/contract-server.ts";
import { bigIntJson } from "../../../util/big-int-json.ts";
import { txnLogStorage } from "@core/storage.ts";

registerSuperJSON();

export const apiServer = new OpenAPIHono();
apiServer.use("/*", cors());

apiServer.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "Lambda Client API",
  },
});
apiServer.get("/swagger", swaggerUI({ url: "/doc" }));

apiServer.route("/", queryServer);
apiServer.route("/", contractServer);

apiServer.get("/txn", async (c) => {
  const allTxns = await txnLogStorage.getAll();
  return c.json(allTxns);
});

// @ts-ignore
apiServer.openapi(Routes.walletBalances, async (c) => {
  const { wallet } = c.req.param();
  const allTokenNames = await getAllTokenContractNames();
  const queries = allTokenNames.map((token) => ({
    contract: token,
    function: "balanceOf",
    args: [wallet],
  }));
  const results = await multiQuery(queries);
  const balances = Object.fromEntries(
    allTokenNames.map((token, index) => [token, results[index]]),
  );
  return new Response(bigIntJson.stringify(balances), {
    headers: { "content-type": "application/json" },
  });
});
