import { LRC20Base } from "../standards/base/LRC20Base.ts";
import { ExecutionError } from "../types/execution-error.ts";
import { Ecosystem } from "../types/ecosystem.ts";
import { LRC721MetadataBase } from "../standards/base/LRC721MetadataBase.ts";

/**
 * Helper class for interacting with LRC721 tokens.
 */
export class NftHelper {
  constructor(
    private contract: string,
    private ecosystem: Ecosystem,
  ) {}

  /**
   * Transfer tokens from the current contract to another wallet.
   * @param to the receiver
   * @param tokenId the token id of the nft
   */
  async transfer(to: string, tokenId: number) {
    const nft = await this.ecosystem.getContractObj<LRC721MetadataBase>(
      this.contract,
    );
    if (!nft) throw new ExecutionError(`Contract ${this.contract} not found`);

    await nft.transfer([to, tokenId]);
  }

  /**
   * Transfer tokens from a wallet to another wallet.
   * @param from the sender
   * @param to the receiver
   * @param tokenId the token id of the nft
   */
  async transferFrom(from: string, to: string, tokenId: number) {
    const nft = await this.ecosystem.getContractObj<LRC20Base>(this.contract);
    if (!nft) throw new ExecutionError(`Contract ${this.contract} not found`);
    await nft.transferFrom([from, to, tokenId]);
  }
}
