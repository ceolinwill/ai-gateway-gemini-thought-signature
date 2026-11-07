import { gateway, generateText, isStepCount, tool } from "ai";
import { z } from "zod";
import { MODEL, report } from "./shared.mjs";

// The same model and gateway, but the tool runs in the client, so the AI SDK runs the loop.
const result = await generateText({
  model: gateway(MODEL),
  prompt: "Call get_weather for Lisbon, then answer in one short sentence.",
  stopWhen: isStepCount(3),
  tools: {
    get_weather: tool({
      description: "Get today's weather for a city.",
      inputSchema: z.object({ city: z.string() }),
      execute: async ({ city }) => ({ city, forecast: "sunny, 22C" }),
    }),
  },
});

report(result);
