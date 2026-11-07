import { gateway, generateText } from "ai";
import { MODEL, report } from "./shared.mjs";

// TOOL=exa npm run repro runs the same check with the Exa search tool.
const webSearch =
  process.env.TOOL === "exa"
    ? gateway.tools.exaSearch({ numResults: 3 })
    : gateway.tools.parallelSearch({ maxResults: 3 });

const result = await generateText({
  model: gateway(MODEL),
  prompt:
    "Call web_search exactly once to find who won the 2022 FIFA World Cup final, then answer in one short sentence.",
  tools: { web_search: webSearch },
});

report(result);
