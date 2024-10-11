import { loadAndInitContractFromFile } from "@external/load-and-init-contract-from-file.ts";

export async function getState(contractName: string) {
  const contract = await loadAndInitContractFromFile(contractName);
  if (!contract) throw Error(`${contract} does not exist`);
  // @ts-ignore
  return contract as Record<string, unknown>;
}
