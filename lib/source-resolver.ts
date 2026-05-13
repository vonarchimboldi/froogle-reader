import { discoverSource, DiscoveryResult } from "./discovery";

type SourceCandidateKind = "direct" | "substack" | "google-news";

type SourceCandidate = {
  url: string;
  label: string;
  reason: string;
  kind: SourceCandidateKind;
};

type WriterProfile = {
  writerName: string;
  primaryPublication: string;
  officialPageUrl: string | null;
  substackUrl: string | null;
  googleNewsQuery: string;
};

type ResolveSourceResult = {
  preview: DiscoveryResult;
  selected: SourceCandidate;
  candidates: SourceCandidate[];
  attempts: SourceAttempt[];
  profile: WriterProfile;
};

type SourceAttempt = SourceCandidate & {
  ok: boolean;
  error?: string;
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export async function resolveSourceFromDescription(description: string): Promise<ResolveSourceResult> {
  const cleaned = description.trim();
  if (cleaned.length < 8) {
    throw new Error("Describe the writer and where they publish.");
  }

  const profile = applyKnownWriterSource(cleaned, await identifyWriterProfile(cleaned));
  const candidates = buildCandidates(profile);
  const attempts: SourceAttempt[] = [];

  for (const candidate of candidates) {
    try {
      const preview = await discoverSource(candidate.url);
      attempts.push({ ...candidate, ok: true });
      return {
        preview: normalizeGoogleNewsPreview(preview, candidate, profile),
        selected: candidate,
        candidates,
        attempts,
        profile
      };
    } catch (error) {
      attempts.push({
        ...candidate,
        ok: false,
        error: error instanceof Error ? error.message : "failed"
      });
    }
  }

  const failureSummary = attempts.map((attempt) => `${attempt.label}: ${attempt.error}`).join(" ");
  throw new Error(`Could not find a working RSS source. Tried ${attempts.length} candidate source(s). ${failureSummary}`);
}

async function identifyWriterProfile(description: string): Promise<WriterProfile> {
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
      instructions: [
        "Identify the writer and their primary publication from the user's short description.",
        "If the writer has an obvious author/profile page at the primary publication, include it.",
        "If the writer has an obvious Substack, include its base URL.",
        "Do not invent precise URLs when uncertain; use null instead.",
        "The Google News query must include both writer name and primary publication when both are known."
      ].join(" "),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Writer description:\n\n${description}`
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "writer_profile",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["writerName", "primaryPublication", "officialPageUrl", "substackUrl", "googleNewsQuery"],
            properties: {
              writerName: { type: "string" },
              primaryPublication: { type: "string" },
              officialPageUrl: { type: ["string", "null"] },
              substackUrl: { type: ["string", "null"] },
              googleNewsQuery: { type: "string" }
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
    throw new Error("LLM source lookup returned no writer profile.");
  }

  const profile = JSON.parse(outputText) as WriterProfile;
  const writerName = cleanLabel(profile.writerName);
  const primaryPublication = cleanLabel(profile.primaryPublication);

  if (!writerName) {
    throw new Error("Could not identify the writer name.");
  }

  return {
    writerName,
    primaryPublication,
    officialPageUrl: normalizeOptionalUrl(profile.officialPageUrl),
    substackUrl: normalizeOptionalUrl(profile.substackUrl),
    googleNewsQuery: cleanLabel(profile.googleNewsQuery) || [writerName, primaryPublication].filter(Boolean).join(" ")
  };
}

function buildCandidates(profile: WriterProfile): SourceCandidate[] {
  const candidates: SourceCandidate[] = [];

  if (profile.substackUrl) {
    candidates.push({
      url: substackFeedUrl(profile.substackUrl),
      label: `${profile.writerName} on Substack`,
      reason: "Native Substack RSS feed.",
      kind: "substack"
    });
  }

  if (profile.officialPageUrl) {
    candidates.push(
      ...directFeedGuesses(profile),
      {
        url: profile.officialPageUrl,
        label: `${profile.writerName}${profile.primaryPublication ? ` at ${profile.primaryPublication}` : ""}`,
        reason: "Author or publication page. The app will use its RSS feed if the page exposes one.",
        kind: "direct"
      }
    );
  }

  candidates.push(googleNewsCandidate(profile));
  return dedupeCandidates(candidates);
}

function applyKnownWriterSource(description: string, profile: WriterProfile): WriterProfile {
  if (/\bderek\s+thompson\b/i.test(`${description} ${profile.writerName}`)) {
    return {
      ...profile,
      writerName: "Derek Thompson",
      primaryPublication: "Derek Thompson",
      officialPageUrl: "https://www.derekthompson.org/",
      substackUrl: "https://www.derekthompson.org/",
      googleNewsQuery: "Derek Thompson Substack"
    };
  }

  return profile;
}

function directFeedGuesses(profile: WriterProfile): SourceCandidate[] {
  if (!profile.officialPageUrl) return [];
  const url = new URL(profile.officialPageUrl);
  const withoutTrailingSlash = url.pathname.replace(/\/$/, "");
  const guesses = [
    ...siteSpecificFeedGuesses(url),
    `${url.origin}${withoutTrailingSlash}/feed`,
    `${url.origin}${withoutTrailingSlash}.rss`,
    `${url.origin}${withoutTrailingSlash}/rss`
  ];

  return guesses.map((guess) => ({
    url: guess,
    label: `${profile.writerName} direct RSS`,
    reason: "Common RSS path derived from the author page.",
    kind: "direct" as const
  }));
}

function siteSpecificFeedGuesses(url: URL) {
  const atlanticAuthorMatch = url.hostname.replace(/^www\./, "") === "theatlantic.com"
    ? url.pathname.match(/^\/author\/([^/]+)\/?$/)
    : null;

  if (atlanticAuthorMatch?.[1]) {
    return [`${url.origin}/feed/author/${atlanticAuthorMatch[1]}/`];
  }

  return [];
}

function googleNewsCandidate(profile: WriterProfile): SourceCandidate {
  const query = encodeURIComponent(profile.googleNewsQuery);
  return {
    url: `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`,
    label: `${profile.writerName}${profile.primaryPublication ? ` - ${profile.primaryPublication}` : ""}`,
    reason: "Google News RSS fallback using writer name and primary publication.",
    kind: "google-news"
  };
}

function normalizeGoogleNewsPreview(
  preview: DiscoveryResult,
  candidate: SourceCandidate,
  profile: WriterProfile
): DiscoveryResult {
  if (candidate.kind !== "google-news") return preview;

  return {
    ...preview,
    name: candidate.label,
    publication: profile.primaryPublication || "Google News",
    sourceUrl: candidate.url
  };
}

function substackFeedUrl(input: string) {
  const url = new URL(input);
  url.hash = "";
  url.search = "";
  url.pathname = "/feed";
  return url.toString();
}

function normalizeOptionalUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
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

function cleanLabel(value?: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}
