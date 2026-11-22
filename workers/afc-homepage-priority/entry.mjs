import openNext from "../../.open-next/worker.js";
import { applyHomepageScriptPriority } from "./priority.mjs";

export * from "../../.open-next/worker.js";

const worker = {
  ...openNext,
  async fetch(request, env, ctx) {
    const response = await openNext.fetch(request, env, ctx);
    return applyHomepageScriptPriority(request, env.APP_ENV, response);
  },
};

export default worker;
