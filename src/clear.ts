import { $ } from "bun";

export const clear = async () => {
  await $`rm -f state.json`;
  await $`rm -f transactions.json`;
  await $`rm -f deployed.json`;
};

await clear();
