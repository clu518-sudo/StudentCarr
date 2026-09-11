// OpenAI's "reasoning" models (o1/o3/o4-* and gpt-5* other than gpt-5-chat*)
// reject params a normal chat model accepts:
// - `temperature` other than the default (1) is rejected outright.
// - Tool calling combined with the server's default reasoning_effort is
//   rejected on /v1/chat/completions ("use /v1/responses or set
//   reasoning_effort to 'none'"). Routing those calls through the Responses
//   API (useResponsesApi) avoids that restriction.
// Mirrors the detection @langchain/openai uses internally (isReasoningModel
// in its utils/misc.ts) so a user-typed model name (e.g. custom proxy/alias
// like "gpt-5.6-luna") that matches the same prefix rules is handled the
// same way here.
export const isReasoningModel = (model: string): boolean => {
  if (!model) {
    return false;
  }
  if (/^o\d/.test(model)) {
    return true;
  }
  return model.startsWith("gpt-5") && !model.startsWith("gpt-5-chat");
};

// Spread into a ChatOpenAI constructor's fields, after the model-specific
// `temperature` you'd otherwise pass — this only fires for reasoning models,
// so non-reasoning callers keep their requested temperature untouched.
export const reasoningSafeChatOpenAIOptions = (model: string) =>
  isReasoningModel(model)
    ? { temperature: undefined, useResponsesApi: true }
    : {};
