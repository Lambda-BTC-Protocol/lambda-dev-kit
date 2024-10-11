import { beforeEach, describe, expect, it } from "bun:test";
import { clear } from "../clear.ts";
import { query, run } from "../util/run.ts";
import { config } from "../config.ts";
import { getState } from "../util/get-state.ts";
import { registerSuperJSON } from "@contracts/utils/superjson-recipes.ts";

registerSuperJSON();

describe("bitcoin test", () => {
  beforeEach(async () => {
    await clear();
  });

  it("bitcoin mint increases balance", async () => {
    await run(
      { contract: "bitcoin", function: "mint", args: [config.wallet, 10000] },
      { sender: "protocol" },
    );
    const bitcoin = (await getState("bitcoin")) as {
      _totalSupply: bigint;
      _balance: Map<string, bigint>;
    };
    expect(bitcoin._totalSupply).toBe(10000n);
    expect(bitcoin._balance.get(config.wallet)).toBe(10000n);
  });

  it("bitcoin transfer changes balances", async () => {
    await run(
      { contract: "bitcoin", function: "mint", args: [config.wallet, 10000] },
      { sender: "protocol" },
    );
    await run({
      contract: "bitcoin",
      function: "transfer",
      args: ["walletB", 100],
    });

    const bitcoin = (await getState("bitcoin")) as {
      _totalSupply: bigint;
      _balance: Map<string, bigint>;
    };

    const balanceWalletB = await query<bigint>({
      contract: "bitcoin",
      function: "balanceOf",
      args: ["walletB"],
    });

    expect(bitcoin._totalSupply).toBe(10000n);
    expect(bitcoin._balance.get(config.wallet)).toBe(10000n - 100n);
    expect(balanceWalletB).toBe(100n);
  });
});
