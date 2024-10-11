import { ExecutionError } from "@contracts/types/execution-error.ts";
import { DEPLOY_PREFIX } from "@contracts/utils/DEPLOY_PREFIX.ts";
import { deployedContractsStorage } from "@core/storage.ts";
import { Metadata } from "@contracts/types/metadata.ts";
import { Scope } from "@core/scopes.ts";

const fullDeployedContractPath = (name: string) => {
  return `${DEPLOY_PREFIX}${name}`;
};

export async function redeployContract(
  templateContract: string,
  newContractName: string,
  metadata: Metadata,
) {
  if (newContractName.length === 0)
    throw new ExecutionError("deploy: name cant be empty");
  if (newContractName.includes("."))
    throw new ExecutionError("deploy: '.' is not allowed in contract name");
  const scope = Scope.getScope(metadata.transactionHash);
  const inStorage = await deployedContractsStorage.get(
    fullDeployedContractPath(newContractName),
  );
  if (inStorage) {
    throw new ExecutionError(
      `redeploy: this contract name ${newContractName} is already taken!`,
    );
  }
  await deployedContractsStorage.set(
    fullDeployedContractPath(newContractName),
    templateContract,
  );
  scope.inscriptionScope.deployedContracts.push(
    fullDeployedContractPath(newContractName),
  );
}

export async function loadDeployedContractName(
  deployedContractName: string,
): Promise<string | null> {
  const inStorage = await deployedContractsStorage.get(deployedContractName);
  if (!inStorage) return null;
  return inStorage;
}

export async function removeFromMapAndStorage(deployedContractName: string) {
  await deployedContractsStorage.delete(deployedContractName);
}
