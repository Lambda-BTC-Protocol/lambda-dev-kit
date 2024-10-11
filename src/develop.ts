import { query, run } from "./util/run.ts";
import { config } from "./config.ts";
import { getState } from "./util/get-state.ts";

export const develop = async () => {
  await run(
    {
      contract: "bitcoin",
      function: "mint",
      args: [config.wallet, 10000000000],
    },
    {
      sender: "protocol",
    },
  );

  await run({
    contract: "bitcoin",
    function: "transfer",
    args: ["walletB", 1000],
  });

  const balance = await query<bigint>({
    contract: "bitcoin",
    function: "balanceOf",
    args: [config.wallet],
  });

  console.log("balance", balance);
};
