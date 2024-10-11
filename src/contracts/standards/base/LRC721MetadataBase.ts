import { ExecutionError } from "../../types/execution-error.ts";
import { EventLogger } from "../../types/event-logger.ts";
import { z } from "zod";
import { argsParsing } from "../../utils/args-parsing.ts";
import { Contract, ContractParams } from "../../types/contract.ts";
import { ExtendedMap } from "../../utils/extended-map.ts";
import { LRC721Metadata } from "../LRC-721-Metadata.ts";

export class LRC721MetadataBase implements Contract, LRC721Metadata {
  activeOn = 0;

  protected _currentTokenId = 0;
  protected _tokenHolder = new ExtendedMap<number, string>();
  protected _approvedFor = new ExtendedMap<number, string>();
  protected _walletApprovedAll = new ExtendedMap<
    string,
    Map<string, boolean>
  >(); // owner -> operator -> approved

  constructor(
    private _name: string,
    private _symbol: string,
    protected _baseUrl: string,
  ) {}

  // *** MUTATIONS ***

  async mint(params: ContractParams) {
    await this._mintLogic(params);
  }

  async transfer({ metadata, eventLogger, args }: ContractParams) {
    const schema = z.tuple([z.string(), z.number()]);
    const [to, tokenId] = argsParsing(schema, args, "transfer");

    const currentHolder = this._tokenHolder.get(tokenId);
    if (!currentHolder) {
      throw new ExecutionError("transfer: tokenId does not have a holder");
    }
    if (currentHolder !== metadata.sender) {
      throw new ExecutionError("transfer: token is not owned by sender");
    }

    await this._transferLogic(metadata.sender, to, tokenId, eventLogger);
  }

  async transferFrom({ args, metadata, eventLogger }: ContractParams) {
    const schema = z.tuple([z.string(), z.string(), z.number()]);
    const [from, to, tokenId] = argsParsing(schema, args, "transferFrom");

    const approvedAddress = this._approvedFor.get(tokenId);
    const approvedAllForMap =
      this._walletApprovedAll.get(from) ?? new Map<string, boolean>();

    const approvedAllForSender =
      approvedAllForMap.get(metadata.sender) ?? false;

    if (metadata.sender !== approvedAddress && !approvedAllForSender) {
      throw new ExecutionError("transferFrom: sender is not approved address");
    }
    await this._transferLogic(from, to, tokenId, eventLogger);
  }

  async approve({ args, metadata, eventLogger }: ContractParams) {
    const schema = z.tuple([z.string(), z.number()]);
    const [approved, tokenId] = argsParsing(schema, args, "approve");

    const holder = this._tokenHolder.get(tokenId);
    if (holder === null || holder !== metadata.sender) {
      throw new ExecutionError(
        "approve: sender is not the holder of the token. Must not approve NFTs of other people",
      );
    }
    this._approvedFor.set(tokenId, approved);

    eventLogger.log({
      type: "APPROVE",
      message: `OWNER: '${metadata.sender}'; TOKENID: '${tokenId}'; APPROVED: ${approved}`,
    });
  }

  async setApprovalForAll({ args, metadata, eventLogger }: ContractParams) {
    const schema = z.tuple([z.string(), z.boolean()]);
    const [operator, approved] = argsParsing(schema, args, "setApprovalForAll");

    this._walletApprovedAll.update(metadata.sender, new Map(), (currentMap) =>
      currentMap.set(operator, approved),
    );

    eventLogger.log({
      type: "APPROVALFORALL",
      message: `OWNER: '${metadata.sender}'; OPERATOR: '${operator}'; APPROVED: ${approved}`,
    });
  }

  // *** QUERIES ***

  name() {
    return this._name;
  }

  symbol() {
    return this._symbol;
  }

  tokenURI({ args }: ContractParams): string | undefined {
    const schema = z.tuple([z.number()]);
    const [tokenId] = argsParsing(schema, args, "tokenUri");

    return `${this._baseUrl}${tokenId}`;
  }

  balanceOf({ args }: ContractParams) {
    const schema = z.tuple([z.string()]);
    const [from] = argsParsing(schema, args, "balanceOf");

    return [...this._tokenHolder.values()].filter((t) => t === from).length;
  }

  ownerOf({ args }: ContractParams) {
    const schema = z.tuple([z.number()]);
    const [tokenId] = argsParsing(schema, args, "ownerOf");

    return this._tokenHolder.get(tokenId);
  }

  getApproved({ args }: ContractParams) {
    const schema = z.tuple([z.number()]);
    const [tokenId] = argsParsing(schema, args, "getApproved");

    return this._approvedFor.get(tokenId);
  }

  owners() {
    const owners: Record<string, number[]> = {};
    for (const [tokenId, holder] of this._tokenHolder) {
      if (owners[holder]) {
        owners[holder]!.push(tokenId);
      } else {
        owners[holder] = [tokenId];
      }
    }
    return owners;
  }

  async isApprovedForAll({ args }: ContractParams) {
    const schema = z.tuple([z.string(), z.string()]);
    const [owner, operator] = argsParsing(schema, args, "isApprovedForAll");

    return this._walletApprovedAll.get(owner)?.get(operator) ?? false;
  }

  protected async _mintLogic({ metadata, eventLogger }: ContractParams) {
    this._tokenHolder.set(this._currentTokenId, metadata.sender);
    eventLogger.log({
      type: "TRANSFER",
      message: `FROM: '0x0'; TO: '${metadata.sender}'; TOKENID: ${this._currentTokenId}`,
    });

    this._currentTokenId++;
    return this._currentTokenId - 1;
  }

  /**
   * handling the logic of transferring a token
   * resets the approval flag for the token id, as the new holder should not have this approval flag set
   * @param from
   * @param to
   * @param tokenId
   * @param eventLogger
   * @protected
   */
  protected async _transferLogic(
    from: string,
    to: string,
    tokenId: number,
    eventLogger: EventLogger,
  ) {
    // update holder of the token
    this._tokenHolder.set(tokenId, to);

    // reset approved flag
    this._approvedFor.delete(tokenId);

    eventLogger.log({
      type: "TRANSFER",
      message: `FROM: '${from}'; TO: '${to}'; TOKENID: ${tokenId}`,
    });
  }
}
