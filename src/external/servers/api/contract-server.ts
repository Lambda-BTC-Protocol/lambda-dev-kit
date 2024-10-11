import { OpenAPIHono } from "@hono/zod-openapi";
import { Routes } from "@external/servers/openapi.ts";
import { Glob } from "bun";
import { loadAndInitContractFromFile } from "@external/load-and-init-contract-from-file.ts";
import { z } from "zod";
import { deployedContractsStorage } from "@core/storage.ts";
import _ from "lodash";
import { multiQuery } from "@external/servers/api/query-server.ts";
import { bigIntJson } from "../../../util/big-int-json.ts";

export const contractServer = new OpenAPIHono();

// @ts-ignore
contractServer.openapi(Routes.tokenContracts, async (c) => {
  const allTokenContractNames = await getAllTokenContractNames();
  const tokenContracts: {
    name: string;
    holders: number;
    totalSupply: bigint;
    decimals: number;
  }[] = [];
  for (const file of allTokenContractNames) {
    const results = await queryContractSpecs(file);
    tokenContracts.push({
      name: file,
      holders: Object.keys(results[0]).length,
      totalSupply: results[1],
      decimals: results[2],
    });
  }

  return new Response(
    bigIntJson.stringify(tokenContracts.sort((a, b) => b.holders - a.holders)),
    {
      headers: { "content-type": "application/json" },
    },
  );
});

contractServer.openapi(Routes.contract, async (c) => {
  const { contract } = c.req.param();
  const x = await db.query.contractStorageTable.findFirst({
    where: (t) => eq(t.contract, contract),
    orderBy: (t) => desc(t.blockNumber),
  });
  logger.debug({ contract, route: "contract" }, "contract request");
  if (!x) return c.json({ error: "Contract not found" }, { status: 404 });
  const state = JSON.parse(x.state);
  const meta = JSON.parse(x.meta);
  return c.json({ state, meta });
});

async function queryContractSpecs(file: string) {
  const queries = [
    {
      contract: file,
      function: "owners",
      args: [],
    },
    {
      contract: file,
      function: "totalSupply",
      args: [],
    },
    {
      contract: file,
      function: "decimals",
      args: [],
    },
  ];
  return (await multiQuery(queries)) as [
    Record<string, bigint>,
    bigint,
    number,
  ];
}

/**
 * get all active token contract names
 */
export async function getAllTokenContractNames() {
  const glob = new Glob("*");

  const contractsOnFile = Array.from(glob.scanSync("src/contracts")).map(
    (file) => file.replace(".ts", ""),
  );
  const activeTokens: string[] = [];
  const tokenContractNames: string[] = [];
  for (const file of contractsOnFile) {
    const contract = await loadAndInitContractFromFile(file);
    const tokenSchema = z.object({
      balanceOf: z.function(),
      decimals: z.function(),
    });
    const { success } = tokenSchema.safeParse(contract);
    if (success) {
      tokenContractNames.push(file);
      activeTokens.push(file);
    }
  }
  const deployedContracts = await deployedContractsStorage.getAll();

  for (const deployedContract of deployedContracts) {
    if (
      _.some(tokenContractNames, (token) => token === deployedContract.template)
    ) {
      activeTokens.push(deployedContract.deployedName);
    }
  }
  return activeTokens;
}
