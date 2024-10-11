import Elysia from "elysia";
import { Metadata } from "@contracts/types/metadata.ts";
import { registerSuperJSON } from "@contracts/utils/superjson-recipes.ts";
import { processInscription } from "@core/process-inscription.ts";

let blockNumber = 1_000_000;

registerSuperJSON();

const genRanHex = (size: number) =>
  [...Array(size)]
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join("");

export const demoServer = new Elysia()
  .post("/inscription/:wallet", async ({ body, params: { wallet } }) => {
    const inscription = (body as any).inscription;
    console.log(inscription);
    const metadata = {
      blockNumber: blockNumber,
      sender: wallet,
      origin: wallet,
      currentContract: "",
      timestamp: new Date().getTime(),
      transactionHash: genRanHex(20),
    } satisfies Metadata;
    await processInscription({
      type: "JOB",
      job: {
        inscriptionString: inscription,
        metadata: metadata,
        extraScopeData: {},
      },
    });
    await processInscription({
      type: "PERSIST",
      block: blockNumber,
    });
    return "OK";
  })
  .post("/block/:block", async ({ params: { block } }) => {
    blockNumber = parseInt(block);

    return "OK";
  })
  .listen(4040);
