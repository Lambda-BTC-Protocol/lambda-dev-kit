import { execute } from "./execute.ts";
import { Scope } from "@core/scopes.ts";
import { config } from "../../config.ts";

export class Query {
  async execute(
    contract: string,
    functionName: string,
    args: Array<unknown>,
  ): Promise<unknown> {
    const metadata = {
      sender: "query",
      origin: "query",
      transactionHash: (1000000).toString(16),
      currentContract: contract,
      timestamp: new Date().valueOf(),
      blockNumber: config.block,
    };
    Scope.createScope(metadata);
    const { result } = await execute(contract, functionName, args, metadata);
    return result;
  }
}
