import { createRoute, z } from "@hono/zod-openapi";

const InSchemas = {
  contract: z.object({
    contract: z.string().openapi({
      param: {
        in: "path",
      },
    }),
  }),
  nonce: z.object({
    address: z.string().openapi({
      param: {
        in: "path",
      },
    }),
  }),
  wallet: z.object({
    wallet: z.string().openapi({
      param: {
        in: "path",
      },
    }),
  }),
};

export const Routes = {
  tokenContracts: createRoute({
    method: "get",
    path: "/contracts/lrc-20",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(
              z.object({
                name: z.string(),
                holders: z.number(),
                amount: z.bigint(),
                decimals: z.number(),
              }),
            ),
          },
        },
        description: "Get contract names of all LRC-20 tokens.",
      },
    },
  }),
  contract: createRoute({
    method: "get",
    path: "/contract/{contract}",
    request: {
      params: InSchemas.contract,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.unknown(),
          },
        },
        description: "Get the full contract state (really big)",
      },
      404: {
        description: "Contract not found",
      },
    },
  }),
  walletBalances: createRoute({
    method: "get",
    path: "/balances/{wallet}",
    request: {
      params: InSchemas.wallet,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.record(z.string(), z.bigint()),
          },
        },
        description: "Get contract names of all LRC-20 tokens.",
      },
    },
  }),
};
