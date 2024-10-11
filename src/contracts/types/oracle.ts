import { SeedableRandom } from "../utils/seedable-random.ts";
import { PriceFeeds } from "@contracts/types/price-feeds.ts";

export type Oracle = {
  getRawBlock: (blockNumber: number) => Promise<Uint8Array>;
  getRandom: () => SeedableRandom;
  getPrice: (priceFeed: PriceFeeds) => Promise<number>;
};
