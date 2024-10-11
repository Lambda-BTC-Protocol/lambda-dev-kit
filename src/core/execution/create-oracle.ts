import { Oracle } from "@contracts/types/oracle.ts";
import { Scope } from "@core/scopes.ts";
import { PriceFeeds } from "@contracts/types/price-feeds.ts";
import { ExecutionError } from "@contracts/types/execution-error.ts";

export const createOracle = (scope: Scope) =>
  ({
    getRawBlock: async (blockNumber: number) => {
      throw new ExecutionError("oracle.getRawBlock is paused.");
      // const raw = await socketClient.emitWithAck("getRawBlock", blockNumber);
    },
    getRandom: () => {
      return scope.inscriptionScope.seedableRandom;
    },
    getPrice: async (priceFeed: PriceFeeds) => {
      return 1;
    },
  }) satisfies Oracle;
