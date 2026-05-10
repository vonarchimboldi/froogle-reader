import { discoverSource, DiscoveryResult } from "./discovery";

type SourceCandidate = {
  url: string;
  label: string;
  reason: string;
};

type ResolveSourceResult = {
  preview: DiscoveryResult;
  selected: SourceCandidate;
  candidates: SourceCandidate[];
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export async function resolveSourceFromDescription(description: string): Promise<ResolveSourceResult> {
  const cleaned = description.trim();
  if (cleaned.length < 8) {
    throw new Error("Describe the writer and where they publish.");
  }

  const candidates = await generateSourceCandidates(cleaned);
  const withFallbacks = dedupeCandidates([...candidates, googleNewsCandidate(cleaned)]);

  const failures: string[] = [];

  for (const candidate of withFallbacks) {
    try {
      const preview = await discoverSource(candidate.url);
      return {
        preview,
        selected: candidate,
        candidates: withFallbacks
      };
    } catch (error) {
      failures.push(`${candidate.url}: ${error instanceof Error ? error.message : "failed"}`);
    }
  }

  throw new Error(`Could not find a working RSS source. Tried ${failures.length} candidate source(s).`);
}

async function generateSourceCandidates(description: string): Promise<SourceCandidate[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the backend.");
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      instructions:
        "You identify likely RSS feed URLs for writers. Return only plausible feed URLs. Prefer direct RSS feeds, Substack /feed URLs, and Google News RSS search URLs. Do not invent a personal website unless the user supplied enough detail.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Find likely RSS feed URLs for this writer description:\n\n${description}`
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "writer_source_candidates",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["candidates"],
            properties: {
              candidates: {
                type: "array",
                minItems: 1,
                maxItems: 6,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["url", "label", "reason"],
                  properties: {
                    url: { type: "string" },
                    label: { type: "string" },
                    reason: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error?.message || "LLM source lookup failed.");
  }

  const outputText = extractOutputText(data);
  if (!outputText) {
    throw new Error("LLM source lookup returned no candidates.");
  }

  const parsed = JSON.parse(outputText) as { candidates?: SourceCandidate[] };
  return dedupeCandidates(parsed.candidates ?? []);
}

function extractOutputText(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const direct = (response as { output_text?: unknown }).output_text;
  if (typeof direct === "string") return direct;

  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) return null;

  for (const item of output) {
    const content = (item as { content?: unknown })?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const text = (part as { text?: unknown })?.text;
      if (typeof text === "string") return text;
    }
  }

  return null;
}

function googleNewsCandidate(description: string): SourceCandidate {
  const query = encodeURIComponent(description);
  return {
    url: `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`,
    label: "Google News RSS",
    reason: "Fallback Google News RSS search for the supplied writer description."
  };
}

function dedupeCandidates(candidates: SourceCandidate[]) {
  const seen = new Set<string>();
  return candidates
    .map((candidate) => ({
      ...candidate,
      url: candidate.url.trim()
    }))
    .filter((candidate) => {
      if (!/^https?:\/\//i.test(candidate.url)) return false;
      if (seen.has(candidate.url)) return false;
      seen.add(candidate.url);
      return true;
    });
}
