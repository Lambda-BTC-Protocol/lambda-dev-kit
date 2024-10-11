import { Contract, ContractParams } from "./types/contract.ts";
import { z } from "zod";
import { argsParsing } from "./utils/args-parsing.ts";
import DmtToken from "./dmt-token.ts";
import { zUtils } from "./utils/zod.ts";

export default class DmtDeployer implements Contract {
  activeOn = 828000;

  deploy = async ({ ecosystem, args }: ContractParams) => {
    const schema = z.tuple([
      z.string(),
      z.string(),
      zUtils.bigint(),
      zUtils.bigint(),
    ]);

    // tslint:disable-next-line
    const [name, symbol] = argsParsing(schema, args, "deploy");

    const deployedToken = await ecosystem.redeployContract<DmtToken>(
      "dmt-token",
      `dmt:${symbol}`,
    );
    await deployedToken.init(args);
  };
}
