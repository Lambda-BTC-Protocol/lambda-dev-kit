import { Contract } from "@contracts/types/contract.ts";
import { loadDeployedContractName } from "@core/redeploy-contract.ts";
import { DEPLOY_PREFIX } from "@contracts/utils/DEPLOY_PREFIX.ts";
import _ from "lodash";
import { contractStateStorage } from "@core/storage.ts";
import { logger } from "@core/logging.ts";

export async function loadAndInitContractFromFile(
  contractName: string,
): Promise<Contract | null> {
  const contractObj = await loadContractFromFile(contractName);
  if (!contractObj) return null;
  const contractState =
    await contractStateStorage.loadContractState(contractName);
  return _.assign(contractObj, contractState);
}

async function loadContractFromFile(
  contractName: string,
): Promise<Contract | null> {
  // if contract is a deployed contract, it can include :
  logger.debug({ contractName }, "loading contract from file");
  if (contractName.startsWith(DEPLOY_PREFIX)) {
    const name = await loadDeployedContractName(contractName);
    if (name === null) return null;
    const clazz = require(`../contracts/${name}`).default;
    return new clazz();
  }
  const clazz = require(`../contracts/${contractName}`).default;
  return new clazz();
}
