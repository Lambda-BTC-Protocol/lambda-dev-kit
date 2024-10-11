import { Inscription } from "@core/types/inscription.ts";
import { Metadata } from "@contracts/types/metadata.ts";
import { processInscription } from "@core/process-inscription.ts";
import { config } from "../config.ts";
import { Query } from "@core/execution/query.ts";

type SmallMetadata = Omit<
  Metadata,
  "blockNumber" | "origin" | "timestamp" | "currentContract" | "transactionHash"
> & {
  blockNumber?: number;
  timestamp?: number;
  transactionHash?: string;
};

type SmallInscription = Omit<Inscription, "p" | "op">;

export async function run(
  inscription: SmallInscription,
  metadata?: SmallMetadata,
) {
  const m = {
    ...metadata,
    sender: metadata?.sender ?? config.wallet,
    origin: metadata?.sender ?? config.wallet,
    currentContract: "",
    blockNumber: config.block,
    timestamp: metadata?.timestamp ?? new Date().getTime(),
    transactionHash: metadata?.transactionHash ?? "0x0",
  } satisfies Metadata;
  return processInscription({ ...inscription, p: "lam", op: "call" }, m);
}

export async function query<T>(inscription: SmallInscription) {
  const q = new Query();
  return (await q.execute(
    inscription.contract,
    inscription.function,
    inscription.args,
  )) as Promise<T>;
}

export async function nextBlock() {
  config.block++;
}
