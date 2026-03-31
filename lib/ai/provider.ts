type ProviderRequest = {
  system: string;
  prompt: string;
  temperature?: number;
};

type ActiveProvider = "openai" | "gemini" | "fallback";

export type ProviderResult = {
  content: string | null;
  source: ActiveProvider;
  model: string;
  providerLabel: "OpenAI" | "Gemini" | "Fallback";
  reason?: string;
};

function resolveOpenAiKey() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  return apiKey || null;
}

function resolveGeminiKey() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  return apiKey || null;
}

function getPreferredProvider(): "auto" | "openai" | "gemini" {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (provider === "openai" || provider === "gemini") return provider;
  return "auto";
}

function resolveProviderConfig() {
  const preferred = getPreferredProvider();
  const openaiKey = resolveOpenAiKey();
  const geminiKey = resolveGeminiKey();

  if (preferred === "gemini") {
    return {
      provider: geminiKey ? ("gemini" as const) : ("fallback" as const),
      apiKey: geminiKey,
      model: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
    };
  }

  if (preferred === "openai") {
    return {
      provider: openaiKey ? ("openai" as const) : ("fallback" as const),
      apiKey: openaiKey,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    };
  }

  if (geminiKey) {
    return {
      provider: "gemini" as const,
      apiKey: geminiKey,
      model: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
    };
  }

  if (openaiKey) {
    return {
      provider: "openai" as const,
      apiKey: openaiKey,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    };
  }

  return {
    provider: "fallback" as const,
    apiKey: null,
    model:
      getPreferredProvider() === "openai"
        ? process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini"
        : process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
  };
}

export function getAiProviderStatus() {
  const config = resolveProviderConfig();

  return {
    configured: config.provider !== "fallback",
    provider: config.provider,
    model: config.model,
    providerLabel:
      config.provider === "openai"
        ? "OpenAI"
        : config.provider === "gemini"
          ? "Gemini"
          : "Fallback",
    reason:
      config.provider === "fallback"
        ? "No AI provider key found. Add GEMINI_API_KEY or OPENAI_API_KEY to .env."
        : null,
  };
}

async function callOpenAi(input: ProviderRequest, model: string, apiKey: string): Promise<ProviderResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: input.temperature ?? 0.3,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.prompt },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        content: null,
        source: "fallback",
        model,
        providerLabel: "OpenAI",
        reason: errorText || `OpenAI request failed with status ${response.status}`,
      };
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };

    const content = json.choices?.[0]?.message?.content?.trim() || null;
    if (!content) {
      return {
        content: null,
        source: "fallback",
        model,
        providerLabel: "OpenAI",
        reason: "OpenAI returned an empty response",
      };
    }

    return {
      content,
      source: "openai",
      model,
      providerLabel: "OpenAI",
    };
  } catch (error) {
    return {
      content: null,
      source: "fallback",
      model,
      providerLabel: "OpenAI",
      reason: error instanceof Error ? error.message : "Unknown OpenAI error",
    };
  }
}

async function callGemini(input: ProviderRequest, model: string, apiKey: string): Promise<ProviderResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: input.system }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: input.prompt }],
            },
          ],
          generationConfig: {
            temperature: input.temperature ?? 0.3,
          },
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        content: null,
        source: "fallback",
        model,
        providerLabel: "Gemini",
        reason: errorText || `Gemini request failed with status ${response.status}`,
      };
    }

    const json = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const content =
      json.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim() || null;

    if (!content) {
      return {
        content: null,
        source: "fallback",
        model,
        providerLabel: "Gemini",
        reason: "Gemini returned an empty response",
      };
    }

    return {
      content,
      source: "gemini",
      model,
      providerLabel: "Gemini",
    };
  } catch (error) {
    return {
      content: null,
      source: "fallback",
      model,
      providerLabel: "Gemini",
      reason: error instanceof Error ? error.message : "Unknown Gemini error",
    };
  }
}

export async function generateWithProviderDetailed(input: ProviderRequest): Promise<ProviderResult> {
  const config = resolveProviderConfig();

  if (config.provider === "openai" && config.apiKey) {
    return callOpenAi(input, config.model, config.apiKey);
  }

  if (config.provider === "gemini" && config.apiKey) {
    return callGemini(input, config.model, config.apiKey);
  }

  return {
    content: null,
    source: "fallback",
    model: config.model,
    providerLabel: "Fallback",
    reason: "No AI provider key found. Add GEMINI_API_KEY or OPENAI_API_KEY to .env.",
  };
}

export async function generateWithProvider(input: ProviderRequest) {
  const result = await generateWithProviderDetailed(input);
  return result.content;
}
