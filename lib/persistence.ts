import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { DiscoveredArticle, DiscoveryResult } from "./discovery";

export async function saveWriterWithArticles(discovery: DiscoveryResult) {
  return prisma.writer.create({
    data: {
      name: discovery.name,
      publication: discovery.publication,
      sourceUrl: discovery.sourceUrl,
      sourceType: discovery.sourceType,
      selectorConfig:
        discovery.selectorConfig === null
          ? Prisma.JsonNull
          : toJson(discovery.selectorConfig),
      lastCheckedAt: new Date(),
      articles: {
        create: discovery.articles.map(articleCreateInput)
      }
    },
    include: {
      _count: { select: { articles: true } },
      articles: {
        orderBy: [{ publishedAt: "desc" }, { discoveredAt: "desc" }],
        take: 20
      }
    }
  });
}

export async function upsertDiscoveredArticles(writerId: string, articles: DiscoveredArticle[]) {
  const result = await prisma.article.createMany({
    data: articles.map((article) => ({
      writerId,
      ...articleCreateInput(article)
    })),
    skipDuplicates: true
  });

  return result.count;
}

function articleCreateInput(article: DiscoveredArticle) {
  const publishedAt = article.publishedAt ? new Date(article.publishedAt) : null;

  return {
    title: article.title,
    url: article.url,
    canonicalUrl: article.canonicalUrl,
    summary: article.summary,
    publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
    rawData: toJson(article.rawData)
  };
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
