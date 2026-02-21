import { MutationCtx, QueryCtx } from "./_generated/server";

export const verifyAuth = async (ctx: MutationCtx | QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User not authenticated");
    }
    return identity;
  };