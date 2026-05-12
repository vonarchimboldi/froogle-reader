import * as cheerio from "cheerio";
import Parser from "rss-parser";
import { SourceType } from "@prisma/client";
import { canonicalizeUrl, normalizeUrl } from "./url";

export type DiscoveredArticle = {
  title: string;
  url: string;
  canonicalUrl: string;
  summary?: string | null;
  publishedAt?: Date | null;
  rawData?: Record<string, unknown>;
};

export type DiscoveryResult = {
  name: string;
  publication?: string | null;
  sourceUrl: string;
  sourceType: SourceType;
  articles: DiscoveredArticle[];
  selectorConfig?: Record<string, unknown> | null;
};

const parser = new Parser({
  timeout: 12000,
  customFields: {
    item: [["media:description", "mediaDescription"], ["content:encoded", "contentEncoded"]]
  }
});

export async function discoverSource(inputUrl: string): Promise<DiscoveryResult> {
  const sourceUrl = normalizeKnownFeedUrl(normalizeUrl(inputUrl));
  const response = await fetch(sourceUrl, {
    redirect: "follow",
    headers: {
      "user-agent": "WriterReaderMVP/0.1 (+https://localhost)",
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(`Could not fetch source: HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  if (!body.trim()) {
    throw new Error("The source returned an empty response.");
  }

  const looksLikeFeed =
    contentType.includes("xml") || /^\s*<(rss|feed|rdf:RDF)\b/i.test(body);

  if (!looksLikeFeed) {
    const pageFeedUrl = findYouTubeFeedUrl(body) ?? findPageFeedUrl(sourceUrl, body);
    if (pageFeedUrl && pageFeedUrl !== sourceUrl) {
      return discoverSource(pageFeedUrl);
    }
  }

  const result = looksLikeFeed ? await discoverFeed(sourceUrl, body) : discoverAuthorPage(sourceUrl, body);

  if (result.articles.length === 0) {
    throw new Error("No articles were discovered from this source.");
  }

  return {
    ...result,
    articles: result.articles.slice(0, 20)
  };
}

function normalizeKnownFeedUrl(sourceUrl: string): string {
  const url = new URL(sourceUrl);
  const hostname = url.hostname.replace(/^www\./, "");

  if (hostname === "youtube.com" || hostname === "m.youtube.com") {
    const channelMatch = url.pathname.match(/^\/channel\/([^/?#]+)/);
    const channelId = channelMatch?.[1] || url.searchParams.get("channel_id");

    if (channelId) {
      return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
    }
  }

  return sourceUrl;
}

function findYouTubeFeedUrl(body: string): string | null {
  const feedMatch = body.match(/https:\/\/www\.youtube\.com\/feeds\/videos\.xml\?channel_id=UC[\w-]+/);
  if (feedMatch?.[0]) return feedMatch[0].replace(/\\u0026/g, "&");

  const externalIdMatch = body.match(/"externalId"\s*:\s*"(UC[\w-]+)"/);
  if (externalIdMatch?.[1]) {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(externalIdMatch[1])}`;
  }

  return null;
}

function findPageFeedUrl(sourceUrl: string, body: string): string | null {
  const $ = cheerio.load(body);
  let feedUrl: string | null = null;

  $("link[rel~='alternate'][href]").each((_, element) => {
    if (feedUrl) return;

    const type = ($(element).attr("type") ?? "").toLowerCase();
    const title = ($(element).attr("title") ?? "").toLowerCase();
    const href = $(element).attr("href");

    if (!href) return;
    if (!type.includes("rss") && !type.includes("atom") && !title.includes("rss") && !title.includes("feed")) return;

    try {
      feedUrl = canonicalizeUrl(href, sourceUrl);
    } catch {
      feedUrl = null;
    }
  });

  return feedUrl;
}

async function discoverFeed(sourceUrl: string, body: string): Promise<DiscoveryResult> {
  const feed = await parser.parseString(body);
  const articles = feed.items
    .map((item) => {
      const url = item.link || item.guid || "";
      if (!url) return null;
      const absoluteUrl = canonicalizeUrl(url, sourceUrl);
      return {
        title: cleanText(item.title) || absoluteUrl,
        url: absoluteUrl,
        canonicalUrl: canonicalizeUrl(item.guid && /^https?:\/\//i.test(item.guid) ? item.guid : absoluteUrl),
        summary: stripHtml(item.contentSnippet || item.summary || item.content || undefined),
        publishedAt: parseDate(item.isoDate || item.pubDate),
        rawData: item as unknown as Record<string, unknown>
      };
    })
    .filter(Boolean) as DiscoveredArticle[];

  return {
    name: cleanText(feed.title) || hostnameLabel(sourceUrl),
    publication: cleanText(feed.description) || hostnameLabel(sourceUrl),
    sourceUrl,
    sourceType: SourceType.RSS,
    articles: dedupeArticles(articles)
  };
}

function discoverAuthorPage(sourceUrl: string, body: string): DiscoveryResult {
  const $ = cheerio.load(body);
  const pageTitle = cleanText($("meta[property='og:title']").attr("content")) || cleanText($("title").first().text());
  const siteName = cleanText($("meta[property='og:site_name']").attr("content")) || hostnameLabel(sourceUrl);
  const links = new Map<string, DiscoveredArticle>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;

    let absoluteUrl: string;
    try {
      absoluteUrl = canonicalizeUrl(href, sourceUrl);
    } catch {
      return;
    }

    if (!isLikelyArticleUrl(absoluteUrl, sourceUrl)) return;

    const title = cleanText($(element).text()) || cleanText($(element).attr("title"));
    if (!title || title.length < 8) return;

    const container = $(element).closest("article, li, div, section").first();
    const nearbyText = cleanText(container.text()).slice(0, 600);
    const dateText = cleanText(container.find("time").first().attr("datetime")) ||
      cleanText(container.find("time").first().text()) ||
      findDateText(nearbyText);

    if (!links.has(absoluteUrl)) {
      links.set(absoluteUrl, {
        title,
        url: absoluteUrl,
        canonicalUrl: absoluteUrl,
        summary: buildSummary(nearbyText, title),
        publishedAt: parseDate(dateText),
        rawData: { extractedFrom: "authorPage", dateText: dateText || null }
      });
    }
  });

  const articles = Array.from(links.values()).sort((a, b) => {
    const aTime = a.publishedAt?.getTime() ?? 0;
    const bTime = b.publishedAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  return {
    name: inferWriterName(pageTitle, siteName),
    publication: siteName,
    sourceUrl,
    sourceType: SourceType.AUTHOR_PAGE,
    selectorConfig: null,
    articles: dedupeArticles(articles)
  };
}

export function dedupeArticles(articles: DiscoveredArticle[]): DiscoveredArticle[] {
  const seen = new Set<string>();
  return articles.filter((article) => {
    if (seen.has(article.canonicalUrl)) return false;
    seen.add(article.canonicalUrl);
    return true;
  });
}

function isLikelyArticleUrl(candidate: string, sourceUrl: string): boolean {
  const url = new URL(candidate);
  const source = new URL(sourceUrl);
  if (url.hostname !== source.hostname) return false;
  if (url.pathname.length < 12) return false;
  if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip)$/i.test(url.pathname)) return false;
  if (/(login|signup|subscribe|privacy|terms|tag|topic|author|writers|about|contact)$/i.test(url.pathname)) {
    return false;
  }

  const articleSignals = [
    /\b\d{4}\/\d{1,2}\/\d{1,2}\b/,
    /\b\d{4}-\d{1,2}-\d{1,2}\b/,
    /\/(story|article|news|opinion|columns?|features?|business|world|india|technology|sports)\//i,
    /-[a-z0-9]{6,}$/i
  ];

  return articleSignals.some((pattern) => pattern.test(url.pathname));
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function findDateText(text: string): string | null {
  const match = text.match(
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/i
  );
  return match?.[0] ?? null;
}

function buildSummary(text: string, title: string): string | null {
  const cleaned = cleanText(text.replace(title, ""));
  return cleaned.length > 40 ? cleaned.slice(0, 240) : null;
}

function inferWriterName(pageTitle: string, fallback: string): string {
  if (!pageTitle) return fallback;
  return pageTitle.split(/[|-]/)[0]?.replace(/\b(author|articles|columns|profile)\b/gi, "").trim() || fallback;
}

function cleanText(value?: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function stripHtml(value?: string): string | null {
  if (!value) return null;
  return cleanText(cheerio.load(value).text()).slice(0, 500) || null;
}

function hostnameLabel(sourceUrl: string): string {
  return new URL(sourceUrl).hostname.replace(/^www\./, "");
}
