import { Contract, ContractParams } from "./types/contract.ts";
import { ExecutionError } from "./types/execution-error.ts";
import { TokenHelper } from "./utils/token-helper.ts";
import { z } from "zod";
import { zUtils } from "./utils/zod.ts";
import { argsParsing } from "./utils/args-parsing.ts";
import { ExtendedMap } from "./utils/extended-map.ts";
import { Metadata } from "./types/metadata.ts";
import { bigIntMin } from "./utils/bigint.ts";
import LAMBCHOP from "./LAMBCHOP.ts";

// accumulated rewards per stake over the blocks; rewards per block is divided by the supply; will be updated on deposit and withdraw
// farming is more difficult than it seems initially. The complexity comes from the impossibility to have continous calculations
// For example the contract is used in block n and n+7. But you still need to give out rewards for the blocks n+1 to n+6
// A common way to resolve this (done in most Ethereum contracts) is to use a debt based system and an accumulating reward per stake
// * the debt is the "rewards" you have already claimed or will never claim because you deposited at a later time
// * the rewards per stake is just accumulating every "update" by dividing the total staked amount by the rewards per block
// for example:
// the current per stake amount is 1_000_000, as the pool already started
// you deposit now 5 BTC
// your initial debt would be 5_000_000, meaning claiming now would give you per stake * stake - debt = (5 * 1_000_000 - 5_000_000) / 10_000 = 0
// now you wait and the per stake gets updated to 1_100_000
// if you check your rewards now you get(5 * 1_100_000 - 5_000_000) / 10_000 = 50
// you get 50 tokens and your debt is 550 now

type Deposit = {
  debt: bigint;
  deposit: bigint;
};

const PER_STAKE_MULTIPLIER = 100_000_000n;

export default class Kitchen implements Contract {
  activeOn = 0;
  _rewardsPerBlock = new Map<string, bigint>(); // the rewards defined per block for a deposit token

  _userDeposit = new ExtendedMap<string, Map<string, Deposit>>(); // sender -> deposit token -> deposit amount
  _totalDeposited = new ExtendedMap<string, bigint>(); // deposit token -> total deposited
  _perStake = new ExtendedMap<string, bigint>(); // deposit token -> accumulated per stake; is multiplied by 10_000 to allow for decimal accumulating
  _lastUpdatedBlock = new ExtendedMap<string, number>(); // deposit token -> last updated block
  _isInitialized = false;

  _owner = "bc1pymguvkanjvxzhwj4m3tdsrsvurj9z237vpwh0uyj6hmaxmnccjeqvej3g4";

  async init({ ecosystem }: ContractParams) {
    if (this._isInitialized)
      throw new ExecutionError("init: can only be done once");

    // Mint the farmy token to this contract
    const lambChop = await ecosystem.getContractObj<LAMBCHOP>("LAMBCHOP");
    if (!lambChop) throw new ExecutionError("init: lambchop token not found");

    const totalSupply = 10_000_000n;
    await lambChop.mint([totalSupply * 10n ** 4n]); // total supply is 10_000_000, but the contract uses 4 decimals
    this._isInitialized = true;
  }

  // *** OWNER METHODS ***

  private _onlyOwner(metadata: Metadata) {
    if (metadata.sender !== this._owner)
      throw new ExecutionError("onlyOwner: only owner can call this method");
  }

  setOwner({ args, metadata }: ContractParams) {
    this._onlyOwner(metadata);
    const schema = z.tuple([z.string()]);
    const [owner] = argsParsing(schema, args, "setOwner");

    this._owner = owner;
  }

  async setRewardsPerBlock({ args, metadata }: ContractParams) {
    this._onlyOwner(metadata);
    const schema = z.tuple([z.string(), zUtils.bigint()]);
    const [depositTokenContract, rewards] = argsParsing(
      schema,
      args,
      "setRewardsPerBlock",
    );

    // update before changing the rewards per block
    this._updatePool(depositTokenContract, metadata.blockNumber);

    this._rewardsPerBlock.set(depositTokenContract, rewards);
  }

  addNewToken({ args, metadata }: ContractParams) {
    this._onlyOwner(metadata);
    const schema = z.tuple([z.string(), zUtils.bigint()]);
    const [depositTokenContract, rewards] = argsParsing(
      schema,
      args,
      "addNewToken",
    );

    if (this._rewardsPerBlock.has(depositTokenContract))
      throw new ExecutionError("addNewToken: token already exists");

    this._rewardsPerBlock.set(depositTokenContract, rewards);
    this._lastUpdatedBlock.set(depositTokenContract, metadata.blockNumber);
    this._totalDeposited.set(depositTokenContract, 0n);
  }

  // *** MUTATIONS ***

  async deposit({ args, metadata, ecosystem, eventLogger }: ContractParams) {
    const schema = z.tuple([z.string(), zUtils.bigint()]);
    const [depositTokenContract, value] = argsParsing(schema, args, "deposit");

    this._updatePool(depositTokenContract, metadata.blockNumber);
    const rewards = this._calculateRewardsForSender(
      metadata.sender,
      depositTokenContract,
    );
    if (rewards > 0n)
      await this.claim({
        args: [depositTokenContract],
        metadata,
        ecosystem,
        eventLogger,
      });

    const depositToken = new TokenHelper(depositTokenContract, ecosystem);
    // move farm token to contract
    await depositToken.transferFrom(
      metadata.sender,
      metadata.currentContract,
      value,
      true,
    );

    const perStake = this._perStake.get(depositTokenContract);

    if (perStake === undefined)
      throw new ExecutionError("deposit: per stake is missing");

    // update deposit balance
    const userDepositsMap =
      this._userDeposit.get(metadata.sender) ?? new Map<string, Deposit>();

    const before = userDepositsMap.get(depositTokenContract) ?? {
      deposit: 0n,
      debt: 0n,
    };

    const after: Deposit = {
      deposit: before.deposit + value,
      debt: before.debt + value * perStake,
    };
    userDepositsMap.set(depositTokenContract, after);
    this._userDeposit.set(metadata.sender, userDepositsMap);

    this._totalDeposited.update(
      depositTokenContract,
      0n,
      (current) => current + value,
    );
  }

  async withdraw(params: ContractParams) {
    const { args, metadata, ecosystem } = params;
    const schema = z.tuple([z.string()]);
    const [depositTokenContract] = argsParsing(schema, args, "withdraw");

    this._updatePool(depositTokenContract, metadata.blockNumber);
    const rewards = this._calculateRewardsForSender(
      metadata.sender,
      depositTokenContract,
    );
    if (rewards > 0n) await this.claim(params);

    const currentDeposit = this._userDeposit
      .get(metadata.sender)
      ?.get(depositTokenContract);

    if (!currentDeposit) throw new ExecutionError("withdraw: no deposit found");

    // transfer back to sender
    const depositToken = new TokenHelper(depositTokenContract, ecosystem);
    await depositToken.transfer(metadata.sender, currentDeposit.deposit);

    // update user deposit
    this._userDeposit.update(metadata.sender, new Map(), (current) => {
      current.delete(depositTokenContract);
      return current;
    });

    // update totalStaked
    this._totalDeposited.update(
      depositTokenContract,
      0n,
      (current) => current - currentDeposit.deposit,
    );
  }

  async claim({ args, metadata, ecosystem }: ContractParams) {
    const schema = z.tuple([z.string()]);
    const [depositTokenContract] = argsParsing(schema, args, "claim");

    this._updatePool(depositTokenContract, metadata.blockNumber);

    const rewards = this._calculateRewardsForSender(
      metadata.sender,
      depositTokenContract,
    );
    if (!rewards)
      throw new ExecutionError("claim: no rewards available to claim");

    const rewardToken = new TokenHelper("LAMBCHOP", ecosystem);

    // check to make sure we dont go over our balance
    const min = bigIntMin(
      rewards,
      await rewardToken.balanceOf(metadata.currentContract),
    );
    await rewardToken.transfer(metadata.sender, min);

    // update user deposit
    this._userDeposit.update(metadata.sender, new Map(), (current) => {
      const deposit = current.get(depositTokenContract);
      if (!deposit) throw new ExecutionError("claim: no deposit found");
      current.set(depositTokenContract, {
        deposit: deposit.deposit,
        debt: deposit.debt + rewards * PER_STAKE_MULTIPLIER,
      });
      return current;
    });
  }

  // *** QUERIES ***

  deposited({ args }: ContractParams) {
    const schema = z.tuple([z.string(), z.string()]);
    const [from, depositTokenContract] = argsParsing(schema, args, "deposited");

    return (
      this._userDeposit.get(from)?.get(depositTokenContract)?.deposit ?? 0n
    );
  }

  rewards({ args, metadata }: ContractParams) {
    const schema = z.tuple([z.string(), z.string()]);
    const [from, depositTokenContract] = argsParsing(schema, args, "rewards");

    const perStake = this._perStake.get(depositTokenContract);
    if (perStake === undefined)
      throw new ExecutionError(
        "calculateRewardsForSender: perStake is missing",
      );

    const deposit = this._userDeposit.get(from)?.get(depositTokenContract);
    if (deposit === undefined) return 0n;

    // calculate rewards since the last updated block by getting the share of total stake
    // and multiplying it by the rewards per block and the blocks since the last update
    const untilUpdate =
      (deposit.deposit * perStake - deposit.debt) / PER_STAKE_MULTIPLIER;

    const totalDeposited = this._totalDeposited.get(depositTokenContract);
    if (!totalDeposited) return 0n;

    const share = Number(deposit.deposit) / Number(totalDeposited);
    const lastBlockUpdate = this._lastUpdatedBlock.get(depositTokenContract);
    if (lastBlockUpdate === undefined) return 0n;
    const sinceUpdate =
      (metadata.blockNumber - lastBlockUpdate) *
      Number(this._rewardsPerBlock.get(depositTokenContract) ?? 0n) *
      share;

    return untilUpdate + BigInt(Math.floor(sinceUpdate));
  }

  totalDeposited({ args }: ContractParams) {
    const schema = z.tuple([z.string()]);
    const [depositTokenContract] = argsParsing(schema, args, "totalStaked");
    return this._totalDeposited.get(depositTokenContract) ?? 0n;
  }

  perBlockRewards({ args }: ContractParams) {
    const schema = z.tuple([z.string()]);
    const [depositTokenContract] = argsParsing(schema, args, "perBlockRewards");
    return this._rewardsPerBlock.get(depositTokenContract) ?? 0n;
  }

  // *** PRIVATE METHODS ***

  private _updatePool(depositTokenContract: string, currentBlock: number) {
    const prevBlock = this._lastUpdatedBlock.get(depositTokenContract);
    if (prevBlock === undefined)
      throw new ExecutionError("updatePool: no previous updated block");

    const rewardsPerBlock = this._rewardsPerBlock.get(depositTokenContract);
    if (rewardsPerBlock === undefined)
      throw new ExecutionError(
        "updatePool: not rewards for this token contract",
      );
    const diff = currentBlock - prevBlock;
    const accumulatedRewards = BigInt(diff) * rewardsPerBlock;
    const totalStaked = this._totalDeposited.get(depositTokenContract);
    if (totalStaked === undefined)
      throw new ExecutionError("updatePool: total staked is missing");
    const perStake =
      totalStaked !== 0n
        ? (accumulatedRewards * PER_STAKE_MULTIPLIER) / totalStaked
        : accumulatedRewards * PER_STAKE_MULTIPLIER;

    this._perStake.update(
      depositTokenContract,
      0n,
      (current) => current + perStake,
    );

    this._lastUpdatedBlock.set(depositTokenContract, currentBlock);
  }

  private _calculateRewardsForSender(
    sender: string,
    depositTokenContract: string,
  ) {
    const perStake = this._perStake.get(depositTokenContract);
    if (perStake === undefined)
      throw new ExecutionError(
        "calculateRewardsForSender: perStake is missing",
      );

    const deposit = this._userDeposit.get(sender)?.get(depositTokenContract);
    if (deposit === undefined) return 0n;

    return (deposit.deposit * perStake - deposit.debt) / PER_STAKE_MULTIPLIER; // divide the multiplied amount to get back the actual amount in token value
  }
}
