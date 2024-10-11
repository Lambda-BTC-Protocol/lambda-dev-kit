export type Config = {
  block: number;
  wallet: string;
};

export const config = { block: 1000000, wallet: "walletA" } satisfies Config;
