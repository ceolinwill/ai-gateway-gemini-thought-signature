// Print warnings ourselves, once each, instead of the AI SDK's default logger.
globalThis.AI_SDK_LOG_WARNINGS = false;

export const MODEL = process.env.MODEL ?? "google/gemini-3.8-flash";

export function report(result) {
  const legs = result.steps.flatMap((step) =>
    (step.providerMetadata?.gateway?.routing?.modelAttempts ?? []).flatMap((attempt) =>
      (attempt.providerAttempts ?? []).map(
        (provider) => `${provider.provider}${provider.toolLoopLegIndex == null ? "" : ` (leg ${provider.toolLoopLegIndex})`}`,
      ),
    ),
  );

  const toolCalls = result.steps.flatMap((step) => step.content.filter((part) => part.type === "tool-call"));

  const signatureWarnings = result.steps
    .flatMap((step) => step.warnings ?? [])
    .filter((warning) => warning.type === "other" && warning.message.includes("thoughtSignature"));

  console.log(`model: ${MODEL}`);
  console.log(`steps: ${result.steps.length}, model calls: ${legs.join(", ")}`);

  for (const call of toolCalls) {
    const signedUnder = Object.entries(call.providerMetadata ?? {})
      .filter(([, value]) => value?.thoughtSignature != null)
      .map(([key]) => key);
    const executedBy = call.providerExecuted ? "gateway" : "client";
    console.log(`tool call ${call.toolName} (executed by ${executedBy}) came back signed under: ${signedUnder.join(", ") || "nothing"}`);
  }

  console.log(`thought signature warnings: ${signatureWarnings.length}`);
  for (const warning of signatureWarnings) console.log(`  ${warning.message}`);
  console.log(`answer: ${result.text}`);

  if (signatureWarnings.length > 0) {
    console.log("FAIL: a function call was replayed to Gemini 3 without its thought signature");
    process.exit(1);
  }

  console.log("OK: every function call was replayed with its thought signature");
}
