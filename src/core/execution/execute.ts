import { Metadata } from "@contracts/types/metadata.ts";
import { loadAndInitContractFromFile } from "@external/load-and-init-contract-from-file.ts";
import { ExecutionError } from "@contracts/types/execution-error.ts";
import { DEPLOY_PREFIX } from "@contracts/utils/DEPLOY_PREFIX.ts";
import { eventLoggerFactory } from "./event-logger-factory.ts";
import { ContractParams } from "@contracts/types/contract.ts";
import { z } from "zod";
import { createEcosystem } from "./create-ecosystem.ts";
import { createOracle } from "./create-oracle.ts";
import { Scope } from "@core/scopes.ts";
import { getLogger } from "@core/logging.ts";

/**
 * Executes a contract function
 * @param contractName contract name
 * @param functionName function name
 * @param args function arguments
 * @param metadata
 */
export async function execute(
  contractName: string,
  functionName: string,
  args: Array<unknown>,
  metadata: Metadata,
): Promise<{
  result: unknown;
}> {
  const { inscriptionScope, executionScope } = Scope.getScope(
    metadata.transactionHash,
  );
  const txnLogger = getLogger(metadata.transactionHash);
  const contract =
    inscriptionScope.contractStateBuffer.get(contractName) ??
    (await loadAndInitContractFromFile(contractName));

  if (contract === null || contract === undefined)
    throw new ExecutionError(`contract ${contractName} not found!`);

  // make sure only active contracts are executed; Deployed contracts are always active
  if (
    contract.activeOn > metadata.blockNumber &&
    !contractName.startsWith(DEPLOY_PREFIX)
  )
    throw new ExecutionError("This contract is not active yet!");

  inscriptionScope.contractStateBuffer.set(contractName, contract);

  const eventLogger = eventLoggerFactory(executionScope.events, contractName);

  const input: ContractParams = {
    metadata: { ...metadata, currentContract: contractName },
    ecosystem: createEcosystem(contractName, metadata),
    eventLogger: eventLogger,
    oracle: createOracle(Scope.getScope(metadata.transactionHash)),
    args,
  };
  const schema = z.function();
  // @ts-expect-error no index signature of type string found on contract
  const func = schema.safeParse(contract[functionName]);
  if (!func.success)
    throw new ExecutionError("execution: function does not exist on contract");

  // not sure exactly but need to bind the file as this inside the execution function. Otherwise class methods didnt work
  txnLogger.debug(
    { contract: contractName, function: functionName },
    "calling smart contract function",
  );
  const result = await func.data.bind(contract)(input);
  txnLogger.debug(
    { contract: contractName, function: functionName },
    "finished smart contract function",
  );

  return {
    result: result,
  };
}
