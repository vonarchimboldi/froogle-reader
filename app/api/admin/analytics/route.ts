import { apiJson, handleOptions, unauthorized } from "@/lib/api-response";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export { handleOptions as OPTIONS };

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const [userCount, writerCount, articleCount, sessionCount, users, recentSessions, recentArticles, sourceChecks] =
    await Promise.all([
      prisma.user.count(),
      prisma.writer.count(),
      prisma.article.count(),
      prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          email: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { writers: true, sessions: true } }
        }
      }),
      prisma.session.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          user: { select: { email: true } }
        }
      }),
      prisma.article.findMany({
        orderBy: [{ discoveredAt: "desc" }, { publishedAt: { sort: "desc", nulls: "last" } }],
        take: 20,
        select: {
          id: true,
          title: true,
          discoveredAt: true,
          publishedAt: true,
          writer: { select: { name: true, user: { select: { email: true } } } }
        }
      }),
      prisma.writer.findMany({
        orderBy: [{ lastCheckedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        take: 20,
        select: {
          id: true,
          name: true,
          sourceUrl: true,
          lastCheckedAt: true,
          user: { select: { email: true } },
          _count: { select: { articles: true } }
        }
      })
    ]);

  return apiJson({
    totals: {
      users: userCount,
      writers: writerCount,
      articles: articleCount,
      activeSessions: sessionCount
    },
    users,
    recentSessions,
    recentArticles,
    sourceChecks
  });
}
