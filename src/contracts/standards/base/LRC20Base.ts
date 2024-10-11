import { ExecutionError } from "../../types/execution-error.ts";
import { EventLogger } from "../../types/event-logger.ts";
import { z } from "zod";
import { argsParsing } from "../../utils/args-parsing.ts";
import { Contract, ContractParams } from "../../types/contract.ts";
import { ExtendedMap } from "../../utils/extended-map.ts";
import { zUtils } from "../../utils/zod.ts";
import { LRC20 } from "../LRC-20.ts";

export class LRC20Base implements Contract, LRC20 {
  _alreadyMinted = false;
  _totalSupply = 0n;
  _allowance = new Map<string, Map<string, bigint>>(); // owner -> spender -> allowance
  _balance = new ExtendedMap<string, bigint>();

  constructor(
    protected _name: string,
    protected _symbol: string,
    protected _decimals: number,
    protected _owner: string,
    public activeOn: number,
  ) {}

  // *** MUTATIONS ***

  async mint(params: ContractParams) {
    await this.mintLogic(params);
  }

  async burn(params: ContractParams) {
    await this.burnLogic(params);
  }

  async transfer({ metadata, eventLogger, args }: ContractParams) {
    const schema = z.tuple([z.string(), zUtils.bigint()]);
    const [to, value] = argsParsing(schema, args, "transfer");
    await this.transferLogic(metadata.sender, to, value, eventLogger);
  }

  async transferFrom({ metadata, eventLogger, args }: ContractParams) {
    const schema = z.tuple([z.string(), z.string(), zUtils.bigint()]);
    const [from, to, value] = argsParsing(schema, args, "transferFrom");

    const fromAllowances =
      this._allowance.get(from) ?? new Map<string, bigint>();
    const allowance = fromAllowances.get(metadata.sender) ?? 0n;
    if (allowance < value)
      throw new ExecutionError(
        "transferFrom: allowance for spender not enough",
      );

    await this.transferLogic(from, to, value, eventLogger);

    // decrease allowance
    fromAllowances.set(metadata.sender, allowance - value);
  }

  async approve({ metadata, eventLogger, args }: ContractParams) {
    const schema = z.tuple([z.string(), zUtils.bigint()]);
    const [spender, value] = argsParsing(schema, args, "approve");

    const myAllowances =
      this._allowance.get(metadata.sender) ?? new Map<string, bigint>();
    myAllowances.set(spender, value);
    this._allowance.set(metadata.sender, myAllowances);

    eventLogger.log({
      type: "APPROVE",
      message: `OWNER: '${metadata.sender}'; SPENDER: '${spender}'; VALUE: ${value}`,
    });
  }

  // *** QUERIES ***

  name() {
    return this._name;
  }

  symbol() {
    return this._symbol;
  }

  decimals() {
    return this._decimals;
  }

  totalSupply() {
    return this._totalSupply;
  }

  owners() {
    return Object.fromEntries(this._balance);
  }

  balanceOf({ args }: ContractParams) {
    const schema = z.tuple([z.string()]);
    const [from] = argsParsing(schema, args, "balanceOf");

    return this._balance.get(from) ?? 0n;
  }

  allowance({ args }: ContractParams) {
    const schema = z.tuple([z.string(), z.string()]);
    const [owner, spender] = argsParsing(schema, args, "allowance");

    return this._allowance.get(owner)?.get(spender) ?? 0n;
  }

  protected async mintLogic({ args, metadata, eventLogger }: ContractParams) {
    const schema = z.tuple([zUtils.bigint()]);
    const [amount] = argsParsing(schema, args, "mint");

    if (metadata.sender !== this._owner)
      throw new ExecutionError("mint: only the owner can mint");
    if (this._alreadyMinted)
      throw new ExecutionError("mint: already minted; can only be done once");

    this._alreadyMinted = true;
    this._internalMint(metadata.sender, amount, eventLogger);
  }

  protected async burnLogic(params: ContractParams) {
    throw new ExecutionError("burn: not implemented");
  }

  /**
   * this is responsible for minting tokens to a wallet.
   * it is handling the logic of updating the balance and total supply
   * @param to
   * @param value
   * @param eventLogger
   * @protected
   */
  protected _internalMint(to: string, value: bigint, eventLogger: EventLogger) {
    this._balance.update(to, 0n, (currentBalance) => currentBalance + value);
    this._totalSupply += value;
    eventLogger.log({
      type: "TRANSFER",
      message: `FROM: 0x0; TO: '${to}'; VALUE: ${value}`,
    });
  }

  /**
   * this is responsible for minting tokens to a wallet.
   * it is handling the logic of updating the balance and total supply
   * also checking balances to make sure it is not going negative
   * @param from
   * @param value
   * @param eventLogger
   * @protected
   */
  protected _internalBurn(
    from: string,
    value: bigint,
    eventLogger: EventLogger,
  ) {
    const currentBalance = this._balance.get(from) ?? 0n;
    if (value > currentBalance)
      throw new ExecutionError("burn: balance too small");
    this._balance.update(from, 0n, (currentBalance) => currentBalance - value);
    this._totalSupply -= value;
    eventLogger.log({
      type: "TRANSFER",
      message: `FROM: ${from}; TO: '0x0'; VALUE: ${value}`,
    });
  }

  /**
   * this is responsible for transferring tokens from one address to another.
   * it is used for both transfer and transferFrom, for transferFrom the allowance check has already succeeded if we reach this method
   *
   * only this method needs to be overwritten if you want to change the transfer logic
   */
  protected async transferLogic(
    from: string,
    to: string,
    value: bigint,
    eventLogger: EventLogger,
  ) {
    const currentBalanceFrom = this._balance.get(from) ?? 0n;
    if (value > currentBalanceFrom)
      throw new ExecutionError("transfer: balance too small");

    this._balance.set(from, currentBalanceFrom - value);
    this._balance.update(
      to,
      0n,
      (currentBalanceTo) => currentBalanceTo + value,
    );

    eventLogger.log({
      type: "TRANSFER",
      message: `FROM: '${from}'; TO: '${to}'; VALUE: ${value}`,
    });
  }
}
