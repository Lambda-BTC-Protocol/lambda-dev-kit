import { z } from "zod";

export const priceFeedSchema = z.union([
  z.literal("BTC/USD"),
  z.literal("ETH/USD"),
]);
export type PriceFeeds = z.infer<typeof priceFeedSchema>;
