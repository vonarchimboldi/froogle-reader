import { prisma } from "./prisma";
import { discoverSource } from "./discovery";
import { upsertDiscoveredArticles } from "./persistence";

export type PollSummary = {
  checked: number;
  created: number;
  failures: Array<{
    writerId: string;
    writerName: string;
    sourceUrl: string;
    error: string;
  }>;
};

export async function pollWriterSources(): Promise<PollSummary> {
  const writers = await prisma.writer.findMany({ orderBy: { createdAt: "asc" } });
  const summary: PollSummary = {
    checked: writers.length,
    created: 0,
    failures: []
  };

  for (const writer of writers) {
    try {
      const discovery = await discoverSource(writer.sourceUrl);
      const created = await upsertDiscoveredArticles(writer.id, discovery.articles);
      await prisma.writer.update({
        where: { id: writer.id },
        data: {
          name: discovery.name || writer.name,
          publication: discovery.publication ?? writer.publication,
          lastCheckedAt: new Date()
        }
      });
      summary.created += created;
    } catch (error) {
      summary.failures.push({
        writerId: writer.id,
        writerName: writer.name,
        sourceUrl: writer.sourceUrl,
        error: error instanceof Error ? error.message : "Unknown error"
      });

      await prisma.writer
        .update({
          where: { id: writer.id },
          data: { lastCheckedAt: new Date() }
        })
        .catch(() => undefined);
    }
  }

  return summary;
}
