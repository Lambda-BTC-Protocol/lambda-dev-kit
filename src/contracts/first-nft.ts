import { LRC721MetadataBase } from "./standards/base/LRC721MetadataBase.ts";
import { ContractParams } from "./types/contract.ts";
import { z } from "zod";
import { argsParsing } from "./utils/args-parsing.ts";

export default class FirstNft extends LRC721MetadataBase {
  activeOn = 828000;

  private _uriMap = new Map<number, string>();

  constructor() {
    super("FirstNft", "FirstNft", "");
  }

  protected async _mintLogic(params: ContractParams) {
    const schema = z.tuple([z.string()]);
    const [uri] = argsParsing(schema, params.args, "mint");
    const tokenId = await super._mintLogic(params);
    this._uriMap.set(tokenId, uri);
    return tokenId;
  }

  tokenURI({ args }: ContractParams): string | undefined {
    const schema = z.tuple([z.number()]);
    const [tokenId] = argsParsing(schema, args, "tokenURI");
    return this._uriMap.get(tokenId);
  }
}
