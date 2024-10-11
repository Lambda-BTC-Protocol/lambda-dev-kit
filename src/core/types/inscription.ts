import { z } from "zod";

const inscriptionContractExecution = z.object({
  contract: z.string(),
  function: z.string(),
  args: z.array(z.unknown()),
});

export const callInscriptionSchema = inscriptionContractExecution.extend({
  p: z.literal("lam"),
  op: z.literal("call"),
});

export type CallInscription = z.infer<typeof callInscriptionSchema>;

export type Inscription = CallInscription;
