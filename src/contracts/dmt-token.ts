import { ContractParams } from "./types/contract.ts";
import { ExecutionError } from "./types/execution-error.ts";
import { LRC20Base } from "./standards/base/LRC20Base.ts";
import { z } from "zod";
import { argsParsing } from "./utils/args-parsing.ts";
import { zUtils } from "./utils/zod.ts";
import { bigIntMin } from "./utils/bigint.ts";

/**
 * is only a template from which are tokens are deployed from.
 * adheres to the LRC-20 standard, with some extra functionality
 * but behaves like the typical Bitcoin Protocol tokens (DMT)
 * - init to define name, symbol, max supply and per mint
 * - mint to mint the defined amount
 * - max supply to get the max supply
 * - per mint to get the per mint limit
 */
export default class DmtToken extends LRC20Base {
  private _initialized = false;
  private _maxSupply = 0n;
  private _perMint = 0n;
  private _userMintedAtBlock = new Map<string, number>();

  constructor() {
    super("DMT", "DMT", 4, "0x0", 1000000000000000);
  }

  init = async ({ eventLogger, args }: ContractParams) => {
    if (this._initialized)
      throw new ExecutionError("init: already initialized");

    const schema = z.tuple([
      z.string(),
      z.string(),
      zUtils.bigint(),
      zUtils.bigint(),
    ]);
    const [name, symbol, maxSupply, perMint] = argsParsing(
      schema,
      args,
      "init",
    );

    this._name = name;
    this._symbol = symbol;
    this._maxSupply = maxSupply;
    this._perMint = perMint;
    this._initialized = true;

    eventLogger.log({
      type: "INIT",
      message: `DMT-style token ${name} is initialized`,
    });
  };

  protected async mintLogic({
    metadata,
    eventLogger,
  }: ContractParams): Promise<void> {
    // check if sender already minted this block
    const blockNumber = metadata.blockNumber;
    const sender = metadata.sender;
    const senderMintedAtBlock = this._userMintedAtBlock.get(sender);
    if (senderMintedAtBlock === blockNumber)
      throw new ExecutionError("mint: minted more than once this block");

    this._userMintedAtBlock.set(sender, blockNumber);

    const totalSupply = this.totalSupply();

    if (totalSupply === this._maxSupply)
      throw new ExecutionError("mint: everything minted!");
    const toMint = bigIntMin(this._perMint, this._maxSupply - totalSupply);
    this._balance.update(metadata.sender, 0n, (value) => value + toMint);
    this._totalSupply += toMint;

    eventLogger.log({
      type: "TRANSFER",
      message: `FROM: '0x0'; TO: '${metadata.sender}'; VALUE: ${toMint}`,
    });
  }

  maxSupply = () => this._maxSupply;

  perMint = () => this._perMint;
}
