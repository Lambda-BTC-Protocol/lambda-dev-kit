import { Ecosystem } from "@contracts/types/ecosystem.ts";
import { Contract } from "@contracts/types/contract.ts";
import {
  contractWrapper,
  WrappedContract,
} from "@contracts/utils/contract-wrapper.ts";
import { loadAndInitContractFromFile } from "@external/load-and-init-contract-from-file.ts";
import { redeployContract } from "../redeploy-contract.ts";
import { DEPLOY_PREFIX } from "@contracts/utils/DEPLOY_PREFIX.ts";
import { Metadata } from "@contracts/types/metadata.ts";
import { ExecutionError } from "@contracts/types/execution-error.ts";
import { eventLoggerFactory } from "./event-logger-factory.ts";
import { createOracle } from "./create-oracle.ts";
import { Scope } from "@core/scopes.ts";

export function createEcosystem(
  callerContractName: string,
  metadata: Metadata,
): Ecosystem {
  const scope = Scope.getScope(metadata.transactionHash);
  return {
    getContractObj: async <T extends Contract>(
      toExecuteContractName: string,
    ): Promise<WrappedContract<T> | null> => {
      return await createWrappedContractObject(
        toExecuteContractName,
        metadata,
        callerContractName,
      );
    },
    redeployContract: async <T extends Contract>(
      templateContract: string,
      newContractName: string,
    ): Promise<WrappedContract<T>> => {
      await redeployContract(templateContract, newContractName, metadata);
      const eventLogger = eventLoggerFactory(
        scope.executionScope.events,
        callerContractName,
      );
      eventLogger.log({
        type: "DEPLOY",
        message: `contract '${DEPLOY_PREFIX}${newContractName}' has been deployed!`,
      });
      const object = await createWrappedContractObject<T>(
        DEPLOY_PREFIX + newContractName,
        metadata,
        callerContractName,
      );
      if (!object) throw new ExecutionError("deploy: Contract not found");
      return object;
    },
  } satisfies Ecosystem;
}

async function createWrappedContractObject<T extends Contract>(
  toExecuteContractName: string,
  metadata: Metadata,
  callerContractName: string,
): Promise<WrappedContract<T> | null> {
  const scope = Scope.getScope(metadata.transactionHash);
  // check if contract is already loaded in memory, otherwise load it from file. contracts acts as a buffer for uncommitted changes
  const contractObj =
    (scope.inscriptionScope.contractStateBuffer.get(
      toExecuteContractName,
    ) as T | null) ??
    ((await loadAndInitContractFromFile(toExecuteContractName)) as T | null);
  if (contractObj === null) return null;

  // make sure only active contracts are executed; Deployed contracts are always active
  if (
    contractObj.activeOn > metadata.blockNumber &&
    !toExecuteContractName.startsWith(DEPLOY_PREFIX)
  )
    throw new ExecutionError("This contract is not active yet!");

  scope.inscriptionScope.contractStateBuffer.set(
    toExecuteContractName,
    contractObj,
  );

  const eventLogger = eventLoggerFactory(
    scope.executionScope.events,
    toExecuteContractName,
  );

  return contractWrapper<T>(contractObj, {
    metadata: {
      ...metadata,
      currentContract: toExecuteContractName,
      sender: callerContractName,
    },
    ecosystem: createEcosystem(toExecuteContractName, metadata),
    oracle: createOracle(scope),
    eventLogger: eventLogger,
  });
}
