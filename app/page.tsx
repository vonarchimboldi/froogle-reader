"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Bookmark,
  BookOpen,
  Check,
  CircleUserRound,
  Clock3,
  ExternalLink,
  Filter,
  Inbox,
  LineChart,
  Layers3,
  Loader2,
  LogOut,
  Plus,
  Radio,
  RefreshCw,
  Rss,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  X
} from "lucide-react";

type Writer = {
  id: string;
  name: string;
  publication?: string | null;
  category?: string | null;
  sourceUrl: string;
  sourceType: "RSS" | "AUTHOR_PAGE";
  lastCheckedAt?: string | null;
  _count: { articles: number };
};

type Article = {
  id: string;
  writerId: string;
  title: string;
  url: string;
  summary?: string | null;
  publishedAt?: string | null;
  discoveredAt: string;
  isRead: boolean;
  isFavorite: boolean;
  isBookmarked: boolean;
  writer: {
    id: string;
    name: string;
    publication?: string | null;
    category?: string | null;
  };
};

type Preview = {
  name: string;
  publication?: string | null;
  sourceUrl: string;
  sourceType: "RSS" | "AUTHOR_PAGE";
  lookup?: SourceLookup | null;
  articles: Array<{
    title: string;
    url: string;
    summary?: string | null;
    publishedAt?: string | null;
  }>;
};

type SourceCandidate = {
  url: string;
  label: string;
  reason: string;
  kind: "direct" | "substack" | "google-news";
};

type SourceAttempt = SourceCandidate & {
  ok: boolean;
  error?: string;
};

type SourceLookup = {
  selected?: SourceCandidate;
  candidates?: SourceCandidate[];
  attempts?: SourceAttempt[];
  profile?: {
    writerName: string;
    primaryPublication: string;
    officialPageUrl: string | null;
    substackUrl: string | null;
    googleNewsQuery: string;
  };
};

type ArticleFilter = "new" | "all";
type SortDirection = "desc" | "asc";
type FeedSelection = "all" | "favorites" | "bookmarks" | string;
type AuthMode = "login" | "signup";
type AppView = "reader" | "account" | "about" | "admin";
type AuthUser = {
  id: string;
  email: string;
  isAdmin?: boolean;
};

type AdminAnalytics = {
  totals: {
    users: number;
    writers: number;
    articles: number;
    activeSessions: number;
  };
  users: Array<{
    id: string;
    email: string;
    createdAt: string;
    updatedAt: string;
    _count: { writers: number; sessions: number };
  }>;
  recentSessions: Array<{
    id: string;
    createdAt: string;
    expiresAt: string;
    user: { email: string };
  }>;
  recentArticles: Array<{
    id: string;
    title: string;
    discoveredAt: string;
    publishedAt?: string | null;
    writer: { name: string; user: { email: string } };
  }>;
  sourceChecks: Array<{
    id: string;
    name: string;
    sourceUrl: string;
    lastCheckedAt?: string | null;
    user: { email: string };
    _count: { articles: number };
  }>;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";

function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

function authHeaders(token: string | null, extraHeaders?: Record<string, string>): HeadersInit {
  return {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...extraHeaders
  };
}

function looksLikeSourceUrl(value: string) {
  return /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/|\?|#|$)/i.test(value.trim());
}

export default function Home() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [hasOpenedReader, setHasOpenedReader] = useState(false);
  const [activeView, setActiveView] = useState<AppView>("reader");
  const [writers, setWriters] = useState<Writer[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedWriterId, setSelectedWriterId] = useState<FeedSelection>("all");
  const [articleFilter, setArticleFilter] = useState<ArticleFilter>("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [writerDescription, setWriterDescription] = useState("");
  const [isSourceFinderOpen, setIsSourceFinderOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [hasAutoCheckedSources, setHasAutoCheckedSources] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [adminAnalytics, setAdminAnalytics] = useState<AdminAnalytics | null>(null);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const selectedWriter = writers.find((writer) => writer.id === selectedWriterId);
  const isMainFeed = selectedWriterId === "all";
  const isFavoritesFeed = selectedWriterId === "favorites";
  const isBookmarksFeed = selectedWriterId === "bookmarks";
  const isSavedFeed = isFavoritesFeed || isBookmarksFeed;
  const isWriterFeed = !isMainFeed && !isSavedFeed;
  const isNewFeed = articleFilter === "new";
  const feedTitle = isFavoritesFeed
    ? "Favorites"
    : isBookmarksFeed
      ? "Bookmarks"
      : isMainFeed
        ? (isNewFeed ? "New articles" : "Main feed")
        : selectedWriter?.name ?? "Writer feed";
  const feedKicker = isSavedFeed ? "Saved articles" : isMainFeed ? (isNewFeed ? "New main feed" : "Main feed") : "Writer feed";
  const feedDescription = isMainFeed
    ? isNewFeed
      ? "Unread articles from every saved writer, sorted by date added"
      : "Every saved article from every writer, sorted by date added"
    : isFavoritesFeed
      ? "Articles you marked as favorites"
      : isBookmarksFeed
        ? "Articles you bookmarked for later"
    : isNewFeed
      ? `Articles from ${selectedWriter?.name ?? "this writer"}, sorted by date added`
      : `Articles from ${selectedWriter?.name ?? "this writer"}, sorted by date added`;
  const totalArticleCount = writers.reduce((sum, writer) => sum + writer._count.articles, 0);
  const unreadCount = useMemo(() => articles.filter((article) => !article.isRead).length, [articles]);
  const favoriteCount = useMemo(() => articles.filter((article) => article.isFavorite).length, [articles]);
  const bookmarkCount = useMemo(() => articles.filter((article) => article.isBookmarked).length, [articles]);
  const writerCategories = useMemo(
    () => Array.from(new Set(writers.map((writer) => writer.category?.trim()).filter(Boolean) as string[])).sort(),
    [writers]
  );
  const categoryOptions = useMemo(() => ["all", ...writerCategories], [writerCategories]);
  const sortedArticles = useMemo(() => {
    const dateFilteredArticles = articles.filter((article) => articleIsInDateRange(article, dateFrom, dateTo));
    return [...dateFilteredArticles].sort((a, b) =>
      sortDirection === "desc" ? compareArticlesByLatestUpdate(a, b) : compareArticlesByLatestUpdate(b, a)
    );
  }, [articles, dateFrom, dateTo, sortDirection]);
  const latestSourceCheckTime = useMemo(() => newestWriterCheckTime(writers), [writers]);
  const sourceCheckLabel = latestSourceCheckTime ? formatDateTime(latestSourceCheckTime) : "Not checked yet";
  const visibleArticles = useMemo(() => {
    const scopedArticles = isWriterFeed
      ? sortedArticles.filter((article) => article.writerId === selectedWriterId || article.writer.id === selectedWriterId)
      : isFavoritesFeed
        ? sortedArticles.filter((article) => article.isFavorite)
        : isBookmarksFeed
          ? sortedArticles.filter((article) => article.isBookmarked)
          : selectedCategory === "all"
            ? sortedArticles
            : sortedArticles.filter((article) => article.writer.category === selectedCategory);

    return isMainFeed && articleFilter === "new"
      ? scopedArticles.filter((article) => !article.isRead)
      : scopedArticles;
  }, [articleFilter, isBookmarksFeed, isFavoritesFeed, isMainFeed, isWriterFeed, selectedCategory, selectedWriterId, sortedArticles]);

  const signOut = useCallback(async () => {
    const token = authToken;
    if (token) {
      await fetch(apiUrl("/api/auth/logout"), {
        method: "POST",
        headers: authHeaders(token)
      }).catch(() => undefined);
    }

    localStorage.removeItem("writerReaderAuthToken");
    setAuthToken(null);
    setAuthUser(null);
    setWriters([]);
    setArticles([]);
    setPreview(null);
    setSelectedWriterId("all");
    setArticleFilter("all");
    setSelectedCategory("all");
    setSortDirection("desc");
    setDateFrom("");
    setDateTo("");
    setIsSourceFinderOpen(false);
    setHasOpenedReader(false);
    setActiveView("reader");
    setHasAutoCheckedSources(false);
  }, [authToken]);

  const refreshData = useCallback(async (token = authToken) => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const writersResponse = await fetch(apiUrl("/api/writers"), { headers: authHeaders(token) });
      const articlesResponse = await fetch(apiUrl("/api/articles"), {
        headers: authHeaders(token)
      });

      if (writersResponse.status === 401 || articlesResponse.status === 401) {
        await signOut();
        return;
      }

      if (!writersResponse.ok || !articlesResponse.ok) {
        throw new Error("Load failed");
      }

      setWriters(await writersResponse.json());
      setArticles(await articlesResponse.json());
    } finally {
      setIsLoading(false);
    }
  }, [authToken, signOut]);

  useEffect(() => {
    const token = localStorage.getItem("writerReaderAuthToken");
    if (!token) {
      setAuthChecked(true);
      setIsLoading(false);
      return;
    }

    setAuthToken(token);
    fetch(apiUrl("/api/auth/me"), { headers: authHeaders(token) })
      .then(async (response) => {
        if (!response.ok) throw new Error("Session expired");
        const data = await response.json();
        setAuthUser(data.user);
        setHasOpenedReader(true);
        setActiveView("reader");
        await refreshData(token);
      })
      .catch(() => {
        localStorage.removeItem("writerReaderAuthToken");
        setAuthToken(null);
        setAuthUser(null);
        setIsLoading(false);
      })
      .finally(() => setAuthChecked(true));
  }, [refreshData]);

  useEffect(() => {
    if (!authUser || !authToken) return;
    refreshData().catch(() => setError("Could not load the reader."));
  }, [authToken, authUser, refreshData]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsAuthenticating(true);

    try {
      const response = await fetch(apiUrl(`/api/auth/${authMode}`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Authentication failed.");

      localStorage.setItem("writerReaderAuthToken", data.token);
      setAuthToken(data.token);
      setAuthUser(data.user);
      setHasOpenedReader(true);
      setActiveView("reader");
      setSelectedWriterId("all");
      setArticleFilter("all");
      setSelectedCategory("all");
      setSortDirection("desc");
      setDateFrom("");
      setDateTo("");
      setAuthPassword("");
      await refreshData(data.token);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleResolveSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPreview(null);
    setIsPreviewing(true);

    try {
      const description = writerDescription.trim();
      const isDirectUrl = looksLikeSourceUrl(description);
      const response = await fetch(apiUrl(isDirectUrl ? "/api/preview-source" : "/api/resolve-source"), {
        method: "POST",
        headers: authHeaders(authToken, { "content-type": "application/json" }),
        body: JSON.stringify(isDirectUrl ? { url: description } : { description })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Source lookup failed.");
      const nextPreview = isDirectUrl ? data : { ...data.preview, lookup: data };
      setPreview(nextPreview);
      setNotice(`Found ${data.selected?.label ?? nextPreview.name ?? "a source"}: ${nextPreview.sourceUrl}`);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Source lookup failed.");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleSave() {
    if (!preview) return;
    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(apiUrl("/api/writers"), {
        method: "POST",
        headers: authHeaders(authToken, { "content-type": "application/json" }),
        body: JSON.stringify({ url: preview.sourceUrl })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save writer.");
      setPreview(null);
      setWriterDescription("");
      setIsSourceFinderOpen(false);
      setSelectedWriterId(data.id);
      await refreshData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save writer.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteWriter(writerId: string) {
    const writer = writers.find((item) => item.id === writerId);
    if (writer && !window.confirm(`Remove ${writer.name} and its saved articles?`)) return;

    const response = await fetch(apiUrl(`/api/writers/${writerId}`), {
      method: "DELETE",
      headers: authHeaders(authToken)
    });
    if (!response.ok) {
      setError("Could not delete writer.");
      return;
    }

    const nextSelection = selectedWriterId === writerId ? "all" : selectedWriterId;
    setSelectedWriterId(nextSelection);
    await refreshData();
  }

  async function updateWriterCategory(writerId: string, currentCategory?: string | null) {
    const nextCategory = window.prompt("Writer category", currentCategory ?? "");
    if (nextCategory === null) return;

    setError(null);
    setNotice(null);

    const response = await fetch(apiUrl(`/api/writers/${writerId}`), {
      method: "PATCH",
      headers: authHeaders(authToken, { "content-type": "application/json" }),
      body: JSON.stringify({ category: nextCategory })
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Could not update writer category.");
      return;
    }

    setWriters((current) => current.map((writer) => (writer.id === writerId ? data : writer)));
    setArticles((current) =>
      current.map((article) =>
        article.writer.id === writerId || article.writerId === writerId
          ? { ...article, writer: { ...article.writer, category: data.category } }
          : article
      )
    );
    setNotice(data.category ? `Moved ${data.name} to ${data.category}.` : `Removed category from ${data.name}.`);
  }

  const checkSourcesNow = useCallback(async (options: { silent?: boolean } = {}) => {
    setIsPolling(true);
    if (!options.silent) {
      setError(null);
      setNotice(null);
    }

    try {
      const response = await fetch(apiUrl("/api/poll"), { method: "POST", headers: authHeaders(authToken) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not check sources.");
      await refreshData();
      if (!options.silent || data.created > 0 || data.failures?.length) {
        setNotice(
          `Checked ${data.checked} source${data.checked === 1 ? "" : "s"}; added ${data.created} new article${
            data.created === 1 ? "" : "s"
          }.${data.failures?.length ? ` ${data.failures.length} failed.` : ""}`
        );
      }
    } catch (pollError) {
      setError(pollError instanceof Error ? pollError.message : "Could not check sources.");
    } finally {
      setIsPolling(false);
    }
  }, [authToken, refreshData]);

  useEffect(() => {
    if (!authUser || !authToken || activeView !== "reader" || isLoading || hasAutoCheckedSources || writers.length === 0) {
      return;
    }

    const sourceCheckIsStale =
      !latestSourceCheckTime || Date.now() - latestSourceCheckTime.getTime() > 60 * 60 * 1000;

    setHasAutoCheckedSources(true);
    if (sourceCheckIsStale) {
      checkSourcesNow({ silent: true }).catch(() => undefined);
    }
  }, [activeView, authToken, authUser, checkSourcesNow, hasAutoCheckedSources, isLoading, latestSourceCheckTime, writers.length]);

  async function toggleRead(article: Article) {
    const nextIsRead = !article.isRead;
    setArticles((current) =>
      current.map((item) => (item.id === article.id ? { ...item, isRead: nextIsRead } : item))
    );

    const response = await fetch(apiUrl(`/api/articles/${article.id}/read`), {
      method: "PATCH",
      headers: authHeaders(authToken, { "content-type": "application/json" }),
      body: JSON.stringify({ isRead: nextIsRead })
    });

    if (!response.ok) {
      setArticles((current) =>
        current.map((item) => (item.id === article.id ? { ...item, isRead: article.isRead } : item))
      );
      setError("Could not update read state.");
    }
  }

  async function toggleArticleFlag(article: Article, field: "isFavorite" | "isBookmarked") {
    const nextValue = !article[field];
    setArticles((current) =>
      current.map((item) => (item.id === article.id ? { ...item, [field]: nextValue } : item))
    );

    const response = await fetch(apiUrl(`/api/articles/${article.id}`), {
      method: "PATCH",
      headers: authHeaders(authToken, { "content-type": "application/json" }),
      body: JSON.stringify({ [field]: nextValue })
    });

    if (!response.ok) {
      setArticles((current) =>
        current.map((item) => (item.id === article.id ? { ...item, [field]: article[field] } : item))
      );
      setError("Could not update saved state.");
      return;
    }

    if ((selectedWriterId === "favorites" && field === "isFavorite") || (selectedWriterId === "bookmarks" && field === "isBookmarked")) {
      setArticles((current) => current.filter((item) => item.id !== article.id || nextValue));
    }
  }

  function openReader() {
    setHasOpenedReader(true);
    setActiveView("reader");
  }

  function openReaderFeed(feed: FeedSelection, filter: ArticleFilter = "all") {
    setSelectedWriterId(feed);
    setArticleFilter(feed === "all" ? filter : "all");
    if (feed !== "all") {
      setSelectedCategory("all");
      setSortDirection("desc");
      setDateFrom("");
      setDateTo("");
    }
    openReader();
  }

  function openAccount() {
    setHasOpenedReader(true);
    setActiveView("account");
  }

  function openAbout() {
    setActiveView("about");
  }

  async function openAdmin() {
    if (!authUser?.isAdmin) {
      setError("You do not have access to analytics.");
      return;
    }

    setHasOpenedReader(true);
    setActiveView("admin");
    if (adminAnalytics || isAdminLoading) return;

    setIsAdminLoading(true);
    setAdminError(null);
    try {
      const response = await fetch(apiUrl("/api/admin/analytics"), {
        headers: authHeaders(authToken)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load analytics.");
      setAdminAnalytics(data);
    } catch (analyticsError) {
      setAdminError(analyticsError instanceof Error ? analyticsError.message : "Could not load analytics.");
    } finally {
      setIsAdminLoading(false);
    }
  }

  if (!authChecked) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f4ef] text-[#20242a]">
        <div className="inline-flex items-center gap-2 text-sm text-[#756c61]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Opening reader
        </div>
      </main>
    );
  }

  if (activeView === "about") {
    return (
      <AboutPage
        authUser={authUser}
        onOpenReader={() => openReaderFeed("all", "all")}
        onOpenSignIn={() => setActiveView("reader")}
        onOpenAccount={openAccount}
        onOpenAdmin={openAdmin}
        onSignOut={signOut}
      />
    );
  }

  if (!authUser) {
    return (
      <main className="min-h-screen bg-[#f6f4ef] text-[#20242a]">
        <header className="border-b border-[#ded7cc] bg-[#fbfaf7]/95 px-4 py-4 backdrop-blur md:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#d36b45] text-white">
                <Rss className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold">Froogle Reader</div>
                <div className="hidden text-xs text-[#756c61] sm:block">Follow your favorite writers</div>
              </div>
            </div>
            <a
              href="#signin"
              className="inline-flex h-10 items-center justify-center rounded-md bg-[#20242a] px-4 text-sm font-semibold text-white hover:bg-black"
            >
              Open reader
            </a>
            <button
              onClick={openAbout}
              className="hidden h-10 items-center justify-center rounded-md border border-[#d8d2c8] bg-white px-4 text-sm font-semibold text-[#485248] hover:bg-[#f1ede5] sm:inline-flex"
            >
              About
            </button>
          </div>
        </header>

        <section className="px-4 py-12 md:px-8 md:py-16">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_470px] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md border border-[#d8d2c8] bg-white px-3 py-1.5 text-sm font-medium text-[#5b6558]">
                <BookOpen className="h-4 w-4" />
                A quieter way to keep up with independent writing
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-[#20242a] md:text-6xl">
                Your personal reading desk for your essential writers.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[#5f574f]">
                Froogle Reader collects articles from RSS feeds and author pages, keeps them organized by writer,
                and gives you a clean place to read, save, and revisit the work that matters.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  href="#signin"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#2f4738] px-5 text-sm font-semibold text-white hover:bg-[#263b2f]"
                >
                  <Rss className="h-4 w-4" />
                  Start reading
                </a>
                <button
                  onClick={openAbout}
                  className="inline-flex h-11 items-center justify-center rounded-md border border-[#d8d2c8] bg-white px-5 text-sm font-semibold text-[#485248] hover:bg-[#f1ede5]"
                >
                  See features
                </button>
              </div>
            </div>

            <ReaderPreview
              articles={sortedArticles}
              isLoading={isLoading}
              isSignedIn={Boolean(authUser)}
              onOpenReader={() => openReaderFeed("all", "all")}
              onOpenUnread={() => openReaderFeed("all", "new")}
              onOpenSaved={() => openReaderFeed("bookmarks")}
              onOpenWriter={(writerId) => openReaderFeed(writerId)}
            />
          </div>
        </section>

        <section id="signin" className="border-t border-[#ded7cc] bg-[#232924] px-4 py-12 text-[#f5f0e8] md:px-8">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-[#f0b29c]">Open your reader</div>
              <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight">Sign in or create an account to start saving writers.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#c9d1c7]">
                Your saved writers and article states persist across sessions, including the Android beta when it is connected
                to a hosted backend.
              </p>
            </div>

            <section className="w-full rounded-lg border border-white/10 bg-white p-5 text-[#20242a] shadow-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-[#d36b45] text-white">
                  <Rss className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Froogle Reader</h3>
                  <p className="text-sm text-[#756c61]">Sign in to your reader</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 rounded-md bg-[#f6f4ef] p-1">
                <button className={authModeButton(authMode === "login")} onClick={() => setAuthMode("login")}>
                  Log in
                </button>
                <button className={authModeButton(authMode === "signup")} onClick={() => setAuthMode("signup")}>
                  Sign up
                </button>
              </div>

              <form onSubmit={handleAuth} className="mt-5 grid gap-3">
                <label className="grid gap-1 text-sm font-medium">
                  Email
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    className="h-11 rounded-md border border-[#d8d2c8] bg-[#fbfaf7] px-3 font-normal outline-none focus:border-[#627566] focus:ring-2 focus:ring-[#627566]/20"
                    autoComplete="email"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Password
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    className="h-11 rounded-md border border-[#d8d2c8] bg-[#fbfaf7] px-3 font-normal outline-none focus:border-[#627566] focus:ring-2 focus:ring-[#627566]/20"
                    autoComplete={authMode === "login" ? "current-password" : "new-password"}
                  />
                </label>

                {error && (
                  <div className="rounded-md border border-[#e7b4a2] bg-[#fff4ef] px-3 py-2 text-sm text-[#8a3a25]">
                    {error}
                  </div>
                )}

                <button
                  disabled={isAuthenticating || !authEmail.trim() || !authPassword}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#2f4738] px-4 text-sm font-semibold text-white transition hover:bg-[#263b2f] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isAuthenticating && <Loader2 className="h-4 w-4 animate-spin" />}
                  {authMode === "login" ? "Log in" : "Create account"}
                </button>
              </form>
            </section>
          </div>
        </section>
      </main>
    );
  }

  if (activeView === "account") {
    return (
      <main className="min-h-screen bg-[#f6f4ef] text-[#20242a]">
        <header className="border-b border-[#ded7cc] bg-[#fbfaf7]/95 px-4 py-4 backdrop-blur md:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <button
              onClick={openReader}
              className="flex min-w-0 items-center gap-3 text-left"
              aria-label="Open reader"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#d36b45] text-white">
                <Rss className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold">Froogle Reader</div>
                <div className="hidden text-xs text-[#756c61] sm:block">Account</div>
              </div>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={openReader}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#d8d2c8] bg-white px-3 text-sm font-semibold text-[#485248] hover:bg-[#f1ede5]"
              >
                <Inbox className="h-4 w-4" />
                Reader
              </button>
              <button
                onClick={openAbout}
                className="inline-flex h-10 items-center justify-center rounded-md border border-[#d8d2c8] bg-white px-3 text-sm font-semibold text-[#485248] hover:bg-[#f1ede5]"
              >
                About
              </button>
              {authUser.isAdmin && (
                <button
                  onClick={openAdmin}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#d8d2c8] bg-white px-3 text-sm font-semibold text-[#485248] hover:bg-[#f1ede5]"
                >
                  <LineChart className="h-4 w-4" />
                  Analytics
                </button>
              )}
              <button
                onClick={signOut}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#20242a] px-3 text-sm font-semibold text-white hover:bg-black"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </header>

        <section className="px-4 py-8 md:px-8">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#8b4b36]">
                <CircleUserRound className="h-3.5 w-3.5" />
                Account
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your reader account</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f665c]">
                Manage the signed-in session for this browser and return to your saved writer feeds.
              </p>

              <div className="mt-6 overflow-hidden rounded-lg border border-[#d8d2c8] bg-white shadow-sm">
                <div className="border-b border-[#e6e1d8] p-5">
                  <div className="text-sm font-semibold">Profile</div>
                  <div className="mt-3 grid gap-1 text-sm">
                    <div className="text-[#756c61]">Email</div>
                    <div className="break-all font-medium">{authUser.email}</div>
                  </div>
                </div>
                <div className="grid gap-3 p-5 sm:grid-cols-2">
                  <button
                    onClick={openReader}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#2f4738] px-4 text-sm font-semibold text-white hover:bg-[#263b2f]"
                  >
                    <Inbox className="h-4 w-4" />
                    Back to reader
                  </button>
                  {authUser.isAdmin && (
                    <button
                      onClick={openAdmin}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#d8d2c8] bg-white px-4 text-sm font-semibold text-[#485248] hover:bg-[#f1ede5]"
                    >
                      <LineChart className="h-4 w-4" />
                      Analytics
                    </button>
                  )}
                  <button
                    onClick={signOut}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#d8d2c8] bg-white px-4 text-sm font-semibold text-[#485248] hover:bg-[#f1ede5]"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            </div>

            <aside className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <SummaryCard icon={<Layers3 className="h-4 w-4" />} label="Writers" value={`${writers.length} saved`} />
              <SummaryCard icon={<Inbox className="h-4 w-4" />} label="Unread" value={`${unreadCount} articles`} />
              <SummaryCard icon={<Bookmark className="h-4 w-4" />} label="Bookmarked" value={`${bookmarkCount} articles`} />
            </aside>
          </div>
        </section>
      </main>
    );
  }

  if (activeView === "admin") {
    return (
      <AdminAnalyticsPage
        analytics={adminAnalytics}
        isLoading={isAdminLoading}
        error={adminError}
        onRefresh={() => {
          setAdminAnalytics(null);
          openAdmin();
        }}
        onOpenReader={() => openReaderFeed("all", "all")}
        onOpenAccount={openAccount}
        onOpenAbout={openAbout}
        onSignOut={signOut}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f4ef] text-[#20242a]">
      <div className="grid min-h-screen lg:grid-cols-[340px_1fr]">
        <aside className="hidden border-r border-[#d7d1c7] bg-[#232924] text-[#f5f0e8] lg:flex lg:flex-col">
          <div className="border-b border-white/10 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-[#d36b45]">
                  <Rss className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-lg font-semibold">Froogle Reader</div>
                  <div className="max-w-[180px] truncate text-xs text-[#b9c0b6]" title={authUser.email}>
                    {authUser.email}
                  </div>
                </div>
              </div>
              <button
                onClick={() => refreshData()}
                className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-[#cfd6cc] hover:bg-white/10"
                title="Refresh"
                aria-label="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2">
              <Metric label="Writers" value={writers.length} />
              <Metric label="Unread" value={unreadCount} />
            </div>
          </div>

          <nav className="reader-scrollbar min-h-0 flex-1 overflow-auto p-3">
            <button
              className={sidebarButton(selectedWriterId === "all")}
              onClick={() => {
                setSelectedWriterId("all");
                setArticleFilter("all");
              }}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Inbox className="h-4 w-4 shrink-0" />
                <span>Main feed</span>
              </span>
              <span className="rounded bg-white/10 px-2 py-0.5 text-xs">{totalArticleCount}</span>
            </button>

            <button
              className={`mt-1 ${sidebarButton(selectedWriterId === "favorites")}`}
              onClick={() => {
                setSelectedWriterId("favorites");
                setSelectedCategory("all");
                setSortDirection("desc");
                setDateFrom("");
                setDateTo("");
              }}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Star className="h-4 w-4 shrink-0" />
                <span>Favorites</span>
              </span>
              <span className="rounded bg-white/10 px-2 py-0.5 text-xs">{favoriteCount}</span>
            </button>

            <button
              className={`mt-1 ${sidebarButton(selectedWriterId === "bookmarks")}`}
              onClick={() => {
                setSelectedWriterId("bookmarks");
                setSelectedCategory("all");
                setSortDirection("desc");
                setDateFrom("");
                setDateTo("");
              }}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Bookmark className="h-4 w-4 shrink-0" />
                <span>Bookmarks</span>
              </span>
              <span className="rounded bg-white/10 px-2 py-0.5 text-xs">{bookmarkCount}</span>
            </button>

            {authUser.isAdmin && (
              <button className={`mt-1 ${sidebarButton(false)}`} onClick={openAdmin}>
                <span className="flex min-w-0 items-center gap-2">
                  <LineChart className="h-4 w-4 shrink-0" />
                  <span>Analytics</span>
                </span>
              </button>
            )}

            <div className="mt-4 px-2 text-xs font-semibold uppercase tracking-wide text-[#94a092]">
              Writer feeds
            </div>

            {writers.map((writer) => (
              <div key={writer.id} className="group mt-1 flex items-stretch gap-1">
                <button
                  className={sidebarButton(selectedWriterId === writer.id)}
                  onClick={() => {
                    setSelectedWriterId(writer.id);
                    setArticleFilter("all");
                    setSelectedCategory("all");
                    setSortDirection("desc");
                    setDateFrom("");
                    setDateTo("");
                  }}
                  title={writer.sourceUrl}
                >
                  <span className="min-w-0 text-left">
                    <span className="block truncate font-medium">{writer.name}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-[#aeb8ac]">
                      <Radio className="h-3 w-3" />
                      {writer.category ? `${writer.category} · ` : ""}
                      {writer.sourceType === "RSS" ? "RSS" : "Author page"} · {writer._count.articles}
                    </span>
                  </span>
                </button>
                <button
                  className="grid w-9 place-items-center rounded-md text-[#cfd6cc] transition hover:bg-white/10"
                  onClick={() => updateWriterCategory(writer.id, writer.category)}
                  aria-label={`Set category for ${writer.name}`}
                  title={writer.category ? `Category: ${writer.category}` : `Set category for ${writer.name}`}
                >
                  <Filter className="h-4 w-4" />
                </button>
                <button
                  className="grid w-9 place-items-center rounded-md text-[#f0b29c] transition hover:bg-white/10"
                  onClick={() => deleteWriter(writer.id)}
                  aria-label={`Delete ${writer.name}`}
                  title={`Delete ${writer.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            {writers.length === 0 && (
              <div className="mx-2 mt-3 rounded-md border border-white/10 bg-white/[0.04] p-4 text-sm text-[#c9d1c7]">
                Saved writers will appear here.
              </div>
            )}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-col">
          <header className="border-b border-[#d8d2c8] bg-[#fbfaf7]/95 px-4 py-4 backdrop-blur md:px-8">
            <div className="mx-auto flex max-w-6xl flex-col gap-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#8b4b36]">
                    <Search className="h-3.5 w-3.5" />
                    {feedKicker}
                  </div>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight">{feedTitle}</h1>
                  <p className="mt-1 text-sm text-[#6f665c]">{feedDescription}</p>
                </div>

                <div className="flex items-center gap-2">
                  {isMainFeed && (
                    <>
                      <button
                        onClick={() => setArticleFilter("new")}
                        className={filterButton(articleFilter === "new")}
                      >
                        New
                      </button>
                      <button
                        onClick={() => setArticleFilter("all")}
                        className={filterButton(articleFilter === "all")}
                      >
                        All
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setIsSourceFinderOpen((isOpen) => !isOpen)}
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d8d2c8] bg-white px-3 text-sm font-semibold text-[#485248] hover:bg-[#f1ede5]"
                  >
                    <Plus className="h-4 w-4" />
                    Add writer
                  </button>
                  <button
                    onClick={() => checkSourcesNow()}
                    disabled={isPolling || writers.length === 0}
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d8d2c8] bg-white px-3 text-sm font-semibold text-[#485248] hover:bg-[#f1ede5] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isPolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
                    Check sources
                  </button>
                  <button
                    onClick={openAccount}
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d8d2c8] bg-white px-3 text-sm font-semibold text-[#485248] hover:bg-[#f1ede5]"
                  >
                    <CircleUserRound className="h-4 w-4" />
                    Account
                  </button>
                  <button
                    onClick={openAbout}
                    className="inline-flex h-10 items-center rounded-md border border-[#d8d2c8] bg-white px-3 text-sm font-semibold text-[#485248] hover:bg-[#f1ede5]"
                  >
                    About
                  </button>
                  {authUser.isAdmin && (
                    <button
                      onClick={openAdmin}
                      className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d8d2c8] bg-white px-3 text-sm font-semibold text-[#485248] hover:bg-[#f1ede5]"
                    >
                      <LineChart className="h-4 w-4" />
                      Analytics
                    </button>
                  )}
                  <button
                    onClick={() => refreshData()}
                    className="grid h-10 w-10 place-items-center rounded-md border border-[#d8d2c8] bg-white text-[#485248] hover:bg-[#f1ede5]"
                    title="Refresh"
                    aria-label="Refresh"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={signOut}
                    className="grid h-10 w-10 place-items-center rounded-md border border-[#d8d2c8] bg-white text-[#485248] hover:bg-[#f1ede5]"
                    title="Sign out"
                    aria-label="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {isSourceFinderOpen && (
                <form
                  onSubmit={handleResolveSource}
                  className="grid gap-2 rounded-lg border border-[#d8d2c8] bg-white p-2 shadow-sm md:grid-cols-[1fr_auto]"
                >
                  <textarea
                    value={writerDescription}
                    onChange={(event) => setWriterDescription(event.target.value)}
                    placeholder="Describe the writer and where they publish"
                    rows={2}
                    className="min-h-14 min-w-0 resize-none rounded-md border-0 bg-[#f6f4ef] px-3 py-2 text-sm outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-[#627566]"
                  />
                  <button
                    disabled={isPreviewing || !writerDescription.trim()}
                    className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-[#2f4738] px-4 text-sm font-semibold text-white transition hover:bg-[#263b2f] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPreviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Find source
                  </button>
                </form>
              )}

              {error && (
                <div className="rounded-md border border-[#e7b4a2] bg-[#fff4ef] px-3 py-2 text-sm text-[#8a3a25]">
                  {error}
                </div>
              )}
              {notice && (
                <div className="rounded-md border border-[#c7d8c9] bg-[#f0f7f0] px-3 py-2 text-sm text-[#31583b]">
                  {notice}
                </div>
              )}
            </div>
          </header>

          <div className="border-b border-[#d8d2c8] bg-[#f6f4ef] px-4 py-3 md:px-8 lg:hidden">
            <div className="flex gap-2">
              <select
                value={selectedWriterId}
                onChange={(event) => {
                  const nextSelection = event.target.value;
                  setSelectedWriterId(nextSelection);
                  setArticleFilter("all");
                  if (nextSelection !== "all") {
                    setSelectedCategory("all");
                    setSortDirection("desc");
                    setDateFrom("");
                    setDateTo("");
                  }
                }}
                className="h-10 min-w-0 flex-1 rounded-md border border-[#d8d2c8] bg-white px-3 text-sm outline-none focus:border-[#627566] focus:ring-2 focus:ring-[#627566]/20"
                aria-label="Filter by writer"
              >
                <option value="all">Main feed</option>
                <option value="favorites">Favorites</option>
                <option value="bookmarks">Bookmarks</option>
                {writers.map((writer) => (
                  <option key={writer.id} value={writer.id}>
                    {writer.name} feed
                  </option>
                ))}
              </select>
              {selectedWriter && (
                <>
                  <button
                    onClick={() => updateWriterCategory(selectedWriter.id, selectedWriter.category)}
                    className="grid h-10 w-10 place-items-center rounded-md border border-[#d8d2c8] bg-white text-[#485248] hover:bg-[#f1ede5]"
                    aria-label={`Set category for ${selectedWriter.name}`}
                    title={selectedWriter.category ? `Category: ${selectedWriter.category}` : `Set category for ${selectedWriter.name}`}
                  >
                    <Filter className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteWriter(selectedWriter.id)}
                    className="grid h-10 w-10 place-items-center rounded-md border border-[#d8d2c8] bg-white text-[#9c4f36] hover:bg-[#fff4ef]"
                    aria-label={`Delete ${selectedWriter.name}`}
                    title={`Delete ${selectedWriter.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
              {authUser.isAdmin && (
                <button
                  onClick={openAdmin}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#d8d2c8] bg-white px-3 text-sm font-semibold text-[#485248] hover:bg-[#f1ede5]"
                >
                  <LineChart className="h-4 w-4" />
                  Analytics
                </button>
              )}
            </div>
          </div>

          {isMainFeed && (
            <div className="border-b border-[#d8d2c8] bg-[#fbfaf7] px-4 py-4 md:px-8">
              <div className="mx-auto grid max-w-6xl gap-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <SummaryCard
                    icon={<Inbox className="h-4 w-4" />}
                    label={isNewFeed ? "New feed" : "Main feed"}
                    value={`${visibleArticles.length} article${visibleArticles.length === 1 ? "" : "s"}`}
                  />
                  <SummaryCard
                    icon={<Filter className="h-4 w-4" />}
                    label="Included writers"
                    value={selectedCategory === "all" ? `${writers.length} writer feeds` : selectedCategory}
                  />
                  <SummaryCard
                    icon={<Clock3 className="h-4 w-4" />}
                    label="Last checked"
                    value={isPolling ? "Checking sources..." : sourceCheckLabel}
                  />
                </div>

                <div className="grid gap-3 rounded-lg border border-[#d8d2c8] bg-white p-3 shadow-sm md:grid-cols-[minmax(150px,1fr)_minmax(140px,180px)_minmax(140px,180px)_minmax(140px,180px)_auto] md:items-end">
                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[#756c61]">
                    Category
                    <select
                      value={selectedCategory}
                      onChange={(event) => setSelectedCategory(event.target.value)}
                      className="h-10 rounded-md border border-[#d8d2c8] bg-[#fbfaf7] px-3 text-sm font-normal normal-case tracking-normal text-[#20242a] outline-none focus:border-[#627566] focus:ring-2 focus:ring-[#627566]/20"
                    >
                      {categoryOptions.map((category) => (
                        <option key={category} value={category}>
                          {category === "all" ? "All categories" : category}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[#756c61]">
                    Sort
                    <select
                      value={sortDirection}
                      onChange={(event) => setSortDirection(event.target.value as SortDirection)}
                      className="h-10 rounded-md border border-[#d8d2c8] bg-[#fbfaf7] px-3 text-sm font-normal normal-case tracking-normal text-[#20242a] outline-none focus:border-[#627566] focus:ring-2 focus:ring-[#627566]/20"
                    >
                      <option value="desc">Newest added first</option>
                      <option value="asc">Oldest added first</option>
                    </select>
                  </label>

                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[#756c61]">
                    From
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(event) => setDateFrom(event.target.value)}
                      className="h-10 rounded-md border border-[#d8d2c8] bg-[#fbfaf7] px-3 text-sm font-normal normal-case tracking-normal text-[#20242a] outline-none focus:border-[#627566] focus:ring-2 focus:ring-[#627566]/20"
                    />
                  </label>

                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[#756c61]">
                    To
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(event) => setDateTo(event.target.value)}
                      className="h-10 rounded-md border border-[#d8d2c8] bg-[#fbfaf7] px-3 text-sm font-normal normal-case tracking-normal text-[#20242a] outline-none focus:border-[#627566] focus:ring-2 focus:ring-[#627566]/20"
                    />
                  </label>

                  <button
                    onClick={() => {
                      setSelectedCategory("all");
                      setSortDirection("desc");
                      setDateFrom("");
                      setDateTo("");
                    }}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#d8d2c8] bg-white px-3 text-sm font-semibold text-[#485248] hover:bg-[#f1ede5]"
                  >
                    <X className="h-4 w-4" />
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="reader-scrollbar flex-1 overflow-auto px-4 py-5 md:px-8">
            <div className="mx-auto max-w-6xl">
              {isLoading ? (
                <div className="grid h-72 place-items-center rounded-lg border border-[#d8d2c8] bg-white text-[#756c61]">
                  <div className="inline-flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading articles
                  </div>
                </div>
              ) : visibleArticles.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#c9c0b3] bg-white px-6 py-14 text-center">
                  <p className="font-semibold">No articles here</p>
                  <p className="mt-1 text-sm text-[#756c61]">
                    {isFavoritesFeed
                      ? "Favorite articles will appear here."
                      : isBookmarksFeed
                        ? "Bookmarked articles will appear here."
                        : isWriterFeed
                          ? "This writer has no saved articles yet."
                          : articleFilter === "new"
                            ? "Everything in this feed has been read."
                            : "Add a writer source to begin."}
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-[#d8d2c8] bg-white shadow-sm">
                  {visibleArticles.map((article) => {
                    const paywall = getPaywallInfo(article);

                    return (
                      <article
                        key={article.id}
                        className={`border-b border-[#e6e1d8] last:border-b-0 ${
                          article.isRead ? "bg-[#fbfaf7]" : "bg-white"
                        }`}
                      >
                        <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:p-5">
                          <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[#766e64]">
                              {!isWriterFeed && (
                                <span className="inline-flex items-center gap-1 rounded bg-[#edf1ed] px-2 py-1 font-medium text-[#36513f]">
                                  <Radio className="h-3 w-3" />
                                  {article.writer.name}
                                </span>
                              )}
                              <span>Added {formatDate(article.discoveredAt)}</span>
                              {article.publishedAt && (
                                <span>Published {formatDate(article.publishedAt)}</span>
                              )}
                              {paywall && (
                                <span className="rounded bg-[#fff0d8] px-2 py-1 font-medium text-[#865315]">
                                  Subscription
                                </span>
                              )}
                              {!article.isRead && <span className="h-2 w-2 rounded-full bg-[#c65d3f]" title="Unread" />}
                            </div>
                            <h2
                              className={`text-lg font-semibold leading-snug tracking-tight ${
                                article.isRead ? "text-[#6f6b64]" : "text-[#20242a]"
                              }`}
                            >
                              {article.title}
                            </h2>
                            {article.summary && (
                              <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-[#5f574f]">
                                {article.summary}
                              </p>
                            )}
                            {paywall && (
                              <p className="mt-2 text-xs text-[#80613b]">
                                {paywall.label} may require a subscription. Froogle Reader keeps the feed excerpt and opens
                                the original site for your logged-in access.
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 md:justify-end">
                            <button
                              onClick={() => toggleArticleFlag(article, "isFavorite")}
                              className={`grid h-9 w-9 place-items-center rounded-md border ${
                                article.isFavorite
                                  ? "border-[#d7a348] bg-[#fff3d6] text-[#9a6518]"
                                  : "border-[#d8d2c8] text-[#303830] hover:bg-[#f1ede5]"
                              }`}
                              title={article.isFavorite ? "Remove favorite" : "Favorite"}
                              aria-label={article.isFavorite ? "Remove favorite" : "Favorite"}
                            >
                              <Star className={`h-4 w-4 ${article.isFavorite ? "fill-current" : ""}`} />
                            </button>
                            <button
                              onClick={() => toggleArticleFlag(article, "isBookmarked")}
                              className={`grid h-9 w-9 place-items-center rounded-md border ${
                                article.isBookmarked
                                  ? "border-[#879b73] bg-[#eef5e8] text-[#405a35]"
                                  : "border-[#d8d2c8] text-[#303830] hover:bg-[#f1ede5]"
                              }`}
                              title={article.isBookmarked ? "Remove bookmark" : "Bookmark"}
                              aria-label={article.isBookmarked ? "Remove bookmark" : "Bookmark"}
                            >
                              <Bookmark className={`h-4 w-4 ${article.isBookmarked ? "fill-current" : ""}`} />
                            </button>
                            <button
                              onClick={() => toggleRead(article)}
                              className="inline-flex h-9 items-center gap-2 rounded-md border border-[#d8d2c8] px-3 text-sm font-medium text-[#303830] hover:bg-[#f1ede5]"
                              title={article.isRead ? "Mark unread" : "Mark read"}
                            >
                              {article.isRead ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                              {article.isRead ? "Unread" : "Read"}
                            </button>
                            <a
                              href={article.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-9 items-center gap-2 rounded-md bg-[#20242a] px-3 text-sm font-medium text-white hover:bg-black"
                              title={paywall ? "Open original with your subscription" : "Open original"}
                            >
                              <ExternalLink className="h-4 w-4" />
                              Open
                            </a>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-0 md:items-center md:p-6">
          <div className="max-h-[88vh] w-full overflow-hidden rounded-t-xl bg-[#fbfaf7] shadow-2xl md:mx-auto md:max-w-3xl md:rounded-xl">
            <div className="flex items-start justify-between border-b border-[#d8d2c8] p-5">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#9c4f36]">
                  {preview.sourceType === "RSS" ? "RSS feed" : "Author page"}
                </div>
                <h2 className="mt-1 truncate text-xl font-semibold">{preview.name}</h2>
                <p className="mt-1 break-all text-sm text-[#6f665c]">{preview.sourceUrl}</p>
                {preview.lookup?.selected && (
                  <p className="mt-2 text-sm text-[#485248]">
                    Selected {preview.lookup.selected.label}. {preview.lookup.selected.reason}
                  </p>
                )}
              </div>
              <button
                onClick={() => setPreview(null)}
                className="grid h-9 w-9 place-items-center rounded-md hover:bg-[#eee7dc]"
                aria-label="Close preview"
                title="Close preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="reader-scrollbar max-h-[52vh] overflow-auto p-5">
              {preview.lookup?.attempts?.length ? (
                <div className="mb-4 rounded-lg border border-[#d8d2c8] bg-white p-3">
                  <div className="text-sm font-semibold">Source check</div>
                  <div className="mt-2 grid gap-2">
                    {preview.lookup.attempts.map((attempt) => (
                      <div key={attempt.url} className="grid gap-1 text-sm">
                        <div className="flex items-center gap-2">
                          {attempt.ok ? (
                            <Check className="h-4 w-4 text-[#31583b]" />
                          ) : (
                            <X className="h-4 w-4 text-[#9c4f36]" />
                          )}
                          <span className="font-medium">{attempt.label}</span>
                        </div>
                        <div className="break-all pl-6 text-xs text-[#756c61]">
                          {attempt.url}
                          {attempt.error ? ` - ${attempt.error}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mb-3 text-sm font-medium">{preview.articles.length} discovered articles</div>
              <div className="divide-y divide-[#e6e1d8] overflow-hidden rounded-lg border border-[#d8d2c8] bg-white">
                {preview.articles.slice(0, 8).map((article) => (
                  <div key={article.url} className="p-4">
                    <div className="text-sm font-semibold">{article.title}</div>
                    <div className="mt-1 text-xs text-[#756c61]">{formatDate(article.publishedAt)}</div>
                    {article.summary && <div className="mt-2 line-clamp-2 text-sm text-[#5f574f]">{article.summary}</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#d8d2c8] p-4">
              <button
                onClick={() => setPreview(null)}
                className="h-10 rounded-md border border-[#d8d2c8] px-4 text-sm font-medium hover:bg-[#f1ede5]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[#c65d3f] px-4 text-sm font-semibold text-white hover:bg-[#a94e35] disabled:opacity-60"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save writer
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function AboutPage({
  authUser,
  onOpenReader,
  onOpenSignIn,
  onOpenAccount,
  onOpenAdmin,
  onSignOut
}: {
  authUser: AuthUser | null;
  onOpenReader: () => void;
  onOpenSignIn: () => void;
  onOpenAccount: () => void;
  onOpenAdmin: () => void;
  onSignOut: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#f6f4ef] text-[#20242a]">
      <header className="border-b border-[#ded7cc] bg-[#fbfaf7]/95 px-4 py-4 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#d36b45] text-white">
              <Rss className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold">Froogle Reader</div>
              <div className="hidden text-xs text-[#756c61] sm:block">About</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {authUser ? (
              <>
                <button
                  onClick={onOpenReader}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#20242a] px-3 text-sm font-semibold text-white hover:bg-black"
                >
                  <Inbox className="h-4 w-4" />
                  Reader
                </button>
                <button
                  onClick={onOpenAccount}
                  className="hidden h-10 items-center justify-center rounded-md border border-[#d8d2c8] bg-white px-3 text-sm font-semibold text-[#485248] hover:bg-[#f1ede5] sm:inline-flex"
                >
                  Account
                </button>
                <button
                  onClick={onOpenAdmin}
                  className="hidden h-10 items-center justify-center gap-2 rounded-md border border-[#d8d2c8] bg-white px-3 text-sm font-semibold text-[#485248] hover:bg-[#f1ede5] md:inline-flex"
                >
                  <LineChart className="h-4 w-4" />
                  Analytics
                </button>
                <button
                  onClick={onSignOut}
                  className="grid h-10 w-10 place-items-center rounded-md border border-[#d8d2c8] bg-white text-[#485248] hover:bg-[#f1ede5]"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                onClick={onOpenSignIn}
                className="inline-flex h-10 items-center justify-center rounded-md bg-[#20242a] px-4 text-sm font-semibold text-white hover:bg-black"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="px-4 py-10 md:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#8b4b36]">About Froogle Reader</div>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
              A focused reader for following individual writers.
            </h1>
            <p className="mt-4 text-base leading-7 text-[#5f574f]">
              Froogle Reader brings RSS feeds, author pages, saved articles, and read state into one private account so
              the latest additions are easy to scan and filter.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={<Search className="h-5 w-5" />}
              title="Find sources quickly"
              description="Describe a writer or paste a URL, then preview the detected RSS feed or author page before saving it."
            />
            <FeatureCard
              icon={<Inbox className="h-5 w-5" />}
              title="Latest-first feed"
              description="Read the newest added articles across every saved writer, then switch to unread or writer-specific views."
            />
            <FeatureCard
              icon={<Star className="h-5 w-5" />}
              title="Save what matters"
              description="Mark articles as read, favorite standout pieces, and bookmark items you want to return to later."
            />
            <FeatureCard
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Private accounts"
              description="Each account keeps its own writers, articles, saved states, and session-backed access."
            />
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <WorkflowStep
              icon={<Layers3 className="h-5 w-5" />}
              title="Collect"
              description="Bring newsletters, RSS feeds, blogs, publication pages, and individual author pages into one reader."
            />
            <WorkflowStep
              icon={<BellRing className="h-5 w-5" />}
              title="Check"
              description="Refresh saved sources on demand and let the reader deduplicate articles by their canonical links."
            />
            <WorkflowStep
              icon={<ExternalLink className="h-5 w-5" />}
              title="Open"
              description="Read excerpts in the feed, then open the original article on the publisher site when you are ready."
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function AdminAnalyticsPage({
  analytics,
  isLoading,
  error,
  onRefresh,
  onOpenReader,
  onOpenAccount,
  onOpenAbout,
  onSignOut
}: {
  analytics: AdminAnalytics | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenReader: () => void;
  onOpenAccount: () => void;
  onOpenAbout: () => void;
  onSignOut: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#f6f4ef] text-[#20242a]">
      <header className="border-b border-[#ded7cc] bg-[#fbfaf7]/95 px-4 py-4 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <button onClick={onOpenReader} className="flex min-w-0 items-center gap-3 text-left">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#d36b45] text-white">
              <LineChart className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold">Froogle Reader</div>
              <div className="hidden text-xs text-[#756c61] sm:block">Analytics</div>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenReader}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#d8d2c8] bg-white px-3 text-sm font-semibold text-[#485248] hover:bg-[#f1ede5]"
            >
              <Inbox className="h-4 w-4" />
              Reader
            </button>
            <button
              onClick={onOpenAccount}
              className="hidden h-10 items-center justify-center rounded-md border border-[#d8d2c8] bg-white px-3 text-sm font-semibold text-[#485248] hover:bg-[#f1ede5] sm:inline-flex"
            >
              Account
            </button>
            <button
              onClick={onOpenAbout}
              className="hidden h-10 items-center justify-center rounded-md border border-[#d8d2c8] bg-white px-3 text-sm font-semibold text-[#485248] hover:bg-[#f1ede5] sm:inline-flex"
            >
              About
            </button>
            <button
              onClick={onSignOut}
              className="grid h-10 w-10 place-items-center rounded-md border border-[#d8d2c8] bg-white text-[#485248] hover:bg-[#f1ede5]"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <section className="px-4 py-8 md:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#8b4b36]">
                <LineChart className="h-3.5 w-3.5" />
                Analytics
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">App activity</h1>
              <p className="mt-2 text-sm leading-6 text-[#6f665c]">
                Registered users, active sessions, saved sources, and latest article additions.
              </p>
            </div>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#d8d2c8] bg-white px-3 text-sm font-semibold text-[#485248] hover:bg-[#f1ede5] disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
          </div>

          {error && (
            <div className="mt-5 rounded-md border border-[#e7b4a2] bg-[#fff4ef] px-3 py-2 text-sm text-[#8a3a25]">
              {error}
            </div>
          )}

          {isLoading && !analytics ? (
            <div className="mt-6 grid h-72 place-items-center rounded-lg border border-[#d8d2c8] bg-white text-[#756c61]">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading analytics
              </span>
            </div>
          ) : analytics ? (
            <div className="mt-6 grid gap-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard icon={<CircleUserRound className="h-4 w-4" />} label="Users" value={String(analytics.totals.users)} />
                <SummaryCard icon={<Layers3 className="h-4 w-4" />} label="Writers" value={String(analytics.totals.writers)} />
                <SummaryCard icon={<Inbox className="h-4 w-4" />} label="Articles" value={String(analytics.totals.articles)} />
                <SummaryCard icon={<Clock3 className="h-4 w-4" />} label="Active sessions" value={String(analytics.totals.activeSessions)} />
              </div>

              <AdminTable
                title="Registered users"
                columns={["Email", "Created", "Writers", "Sessions"]}
                rows={analytics.users.map((user) => [
                  user.email,
                  formatDateTime(user.createdAt),
                  String(user._count.writers),
                  String(user._count.sessions)
                ])}
              />
              <AdminTable
                title="Recent sessions"
                columns={["Email", "Started", "Expires"]}
                rows={analytics.recentSessions.map((session) => [
                  session.user.email,
                  formatDateTime(session.createdAt),
                  formatDateTime(session.expiresAt)
                ])}
              />
              <AdminTable
                title="Latest article additions"
                columns={["Article", "Writer", "Account", "Added"]}
                rows={analytics.recentArticles.map((article) => [
                  article.title,
                  article.writer.name,
                  article.writer.user.email,
                  formatDateTime(article.discoveredAt)
                ])}
              />
              <AdminTable
                title="Source checks"
                columns={["Writer", "Account", "Articles", "Last checked"]}
                rows={analytics.sourceChecks.map((writer) => [
                  writer.name,
                  writer.user.email,
                  String(writer._count.articles),
                  writer.lastCheckedAt ? formatDateTime(writer.lastCheckedAt) : "Not checked"
                ])}
              />
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function AdminTable({ title, columns, rows }: { title: string; columns: string[]; rows: string[][] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#d8d2c8] bg-white shadow-sm">
      <div className="border-b border-[#e6e1d8] px-4 py-3 text-sm font-semibold">{title}</div>
      <div className="reader-scrollbar overflow-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="bg-[#fbfaf7] text-left text-xs uppercase tracking-wide text-[#756c61]">
            <tr>
              {columns.map((column) => (
                <th key={column} className="border-b border-[#e6e1d8] px-4 py-3 font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, rowIndex) => (
                <tr key={`${title}-${rowIndex}`} className="border-b border-[#e6e1d8] last:border-b-0">
                  {row.map((cell, cellIndex) => (
                    <td key={`${title}-${rowIndex}-${cellIndex}`} className="max-w-[340px] truncate px-4 py-3" title={cell}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-6 text-center text-[#756c61]" colSpan={columns.length}>
                  No data yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-[#aeb8ac]">{label}</div>
    </div>
  );
}

function ReaderPreview({
  articles,
  isLoading,
  isSignedIn,
  onOpenReader,
  onOpenUnread,
  onOpenSaved,
  onOpenWriter
}: {
  articles: Article[];
  isLoading: boolean;
  isSignedIn: boolean;
  onOpenReader: () => void;
  onOpenUnread: () => void;
  onOpenSaved: () => void;
  onOpenWriter: (writerId: string) => void;
}) {
  const fallbackArticles = [
    {
      id: "fallback-1",
      writerId: "",
      writer: "Maya Srinivasan",
      title: "Why product teams should read slower",
      meta: "Essay Room · Today",
      url: "#signin",
      isUnread: true
    },
    {
      id: "fallback-2",
      writerId: "",
      writer: "Daniel Hart",
      title: "A field note on newsletters, feeds, and attention",
      meta: "Personal site · Yesterday",
      url: "#signin",
      isUnread: false
    },
    {
      id: "fallback-3",
      writerId: "",
      writer: "Leah Park",
      title: "The useful middle ground between bookmarking and reading",
      meta: "RSS feed · May 12",
      url: "#signin",
      isUnread: false
    }
  ];
  const previewArticles = isSignedIn && articles.length > 0
    ? articles.slice(0, 3).map((article) => ({
        id: article.id,
        writerId: article.writer.id,
        writer: article.writer.name,
        title: article.title,
        meta: `${article.writer.publication ?? "Saved source"} · ${formatDate(article.discoveredAt)}`,
        url: article.url,
        isUnread: !article.isRead
      }))
    : fallbackArticles;
  const unreadCount = isSignedIn ? articles.filter((article) => !article.isRead).length : 12;
  const writerCount = isSignedIn ? new Set(articles.map((article) => article.writer.id)).size : 8;
  const savedCount = isSignedIn
    ? articles.filter((article) => article.isFavorite || article.isBookmarked).length
    : 5;

  return (
    <div className="rounded-lg border border-[#d8d2c8] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#e6e1d8] p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-[#232924] text-white">
            <Inbox className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">{isSignedIn ? "Latest articles" : "New articles"}</div>
            <div className="text-xs text-[#756c61]">
              {isSignedIn ? `${unreadCount} unread from ${writerCount} writers` : "12 unread from 8 writers"}
            </div>
          </div>
        </div>
        <button
          onClick={onOpenReader}
          className="grid h-9 w-9 place-items-center rounded-md border border-[#d8d2c8] text-[#485248] hover:bg-[#f1ede5]"
          aria-label="Open reader"
          title="Open reader"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-0 divide-y divide-[#e6e1d8]">
        {previewArticles.map((article, index) => (
          <div key={article.id} className={index === 0 ? "bg-white p-4" : "bg-[#fbfaf7] p-4"}>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[#766e64]">
              <button
                onClick={() => article.writerId ? onOpenWriter(article.writerId) : onOpenReader()}
                className="inline-flex items-center gap-1 rounded bg-[#edf1ed] px-2 py-1 font-medium text-[#36513f] hover:bg-[#dfe8df]"
              >
                <Radio className="h-3 w-3" />
                {article.writer}
              </button>
              <span>{article.meta}</span>
              {article.isUnread && (
                <span className="h-2 w-2 rounded-full bg-[#c65d3f]" title="Unread" />
              )}
            </div>
            <a
              href={article.url}
              target={isSignedIn ? "_blank" : undefined}
              rel={isSignedIn ? "noreferrer" : undefined}
              className="block text-base font-semibold leading-snug tracking-tight hover:text-[#8b4b36]"
            >
              {article.title}
            </a>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={onOpenSaved}
                className="grid h-8 w-8 place-items-center rounded-md border border-[#d8d2c8] text-[#303830] hover:bg-[#f1ede5]"
                aria-label="Open saved articles"
                title="Open saved articles"
              >
                <Star className="h-4 w-4" />
              </button>
              <button
                onClick={onOpenSaved}
                className="grid h-8 w-8 place-items-center rounded-md border border-[#d8d2c8] text-[#303830] hover:bg-[#f1ede5]"
                aria-label="Open saved articles"
                title="Open saved articles"
              >
                <Bookmark className="h-4 w-4" />
              </button>
              <a
                href={article.url}
                target={isSignedIn ? "_blank" : undefined}
                rel={isSignedIn ? "noreferrer" : undefined}
                className="inline-flex h-8 items-center gap-2 rounded-md bg-[#20242a] px-3 text-sm font-medium text-white hover:bg-black"
              >
                <ExternalLink className="h-4 w-4" />
                Open
              </a>
            </div>
          </div>
        ))}

        {isSignedIn && isLoading && (
          <div className="grid h-24 place-items-center bg-[#fbfaf7] text-sm text-[#756c61]">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading latest articles
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-[#e6e1d8] bg-[#f6f4ef] p-3">
        <MiniMetric value={String(writerCount)} label="Writers" onClick={onOpenReader} />
        <MiniMetric value={String(unreadCount)} label="Unread" onClick={onOpenUnread} />
        <MiniMetric value={String(savedCount)} label="Saved" onClick={onOpenSaved} />
      </div>
    </div>
  );
}

function MiniMetric({ value, label, onClick }: { value: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border border-[#d8d2c8] bg-white p-3 text-left hover:bg-[#f1ede5]"
    >
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-[#756c61]">{label}</div>
    </button>
  );
}

function FeatureCard({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-lg border border-[#d8d2c8] bg-white p-5 shadow-sm">
      <div className="grid h-10 w-10 place-items-center rounded-md bg-[#edf1ed] text-[#36513f]">{icon}</div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#6f665c]">{description}</p>
    </div>
  );
}

function WorkflowStep({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#d36b45] text-white">{icon}</div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-[#6f665c]">{description}</p>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[#d8d2c8] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#82786d]">
        {icon}
        {label}
      </div>
      <div className="mt-2 truncate text-sm font-semibold text-[#20242a]" title={value}>
        {value}
      </div>
    </div>
  );
}

function sidebarButton(isActive: boolean) {
  return [
    "flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm transition",
    isActive ? "bg-white text-[#20242a] shadow-sm" : "text-[#eef3eb] hover:bg-white/10"
  ].join(" ");
}

function filterButton(isActive: boolean) {
  return [
    "h-10 rounded-md px-4 text-sm font-semibold transition",
    isActive
      ? "bg-[#20242a] text-white"
      : "border border-[#d8d2c8] bg-white text-[#485248] hover:bg-[#f1ede5]"
  ].join(" ");
}

function authModeButton(isActive: boolean) {
  return [
    "h-9 rounded px-3 text-sm font-semibold transition",
    isActive ? "bg-white text-[#20242a] shadow-sm" : "text-[#756c61] hover:text-[#20242a]"
  ].join(" ");
}

function getPaywallInfo(article: Article): { label: string } | null {
  let hostname = "";
  try {
    hostname = new URL(article.url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }

  const paywalledDomains: Record<string, string> = {
    "bloomberg.com": "Bloomberg",
    "economist.com": "The Economist",
    "ft.com": "Financial Times",
    "foreignaffairs.com": "Foreign Affairs",
    "hindustantimes.com": "Hindustan Times",
    "newyorker.com": "The New Yorker",
    "nytimes.com": "The New York Times",
    "theatlantic.com": "The Atlantic",
    "telegraphindia.com": "The Telegraph",
    "wsj.com": "The Wall Street Journal",
    "washingtonpost.com": "The Washington Post"
  };

  const match = Object.entries(paywalledDomains).find(([domain]) => hostname === domain || hostname.endsWith(`.${domain}`));
  return match ? { label: match[1] } : null;
}

function formatDate(value?: string | null) {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return "unknown";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function newestWriterCheckTime(writers: Writer[]) {
  const latest = writers.reduce((max, writer) => {
    if (!writer.lastCheckedAt) return max;
    const time = new Date(writer.lastCheckedAt).getTime();
    return Number.isNaN(time) ? max : Math.max(max, time);
  }, 0);

  return latest ? new Date(latest) : null;
}

function compareArticlesByLatestUpdate(a: Article, b: Article) {
  return articleSortTime(b) - articleSortTime(a);
}

function articleIsInDateRange(article: Article, dateFrom: string, dateTo: string) {
  const time = articleSortTime(article);
  if (!time) return false;

  if (dateFrom) {
    const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
    if (!Number.isNaN(fromTime) && time < fromTime) return false;
  }

  if (dateTo) {
    const toTime = new Date(`${dateTo}T23:59:59.999`).getTime();
    if (!Number.isNaN(toTime) && time > toTime) return false;
  }

  return true;
}

function articleSortTime(article: Article) {
  const discoveredTime = new Date(article.discoveredAt).getTime();
  if (!Number.isNaN(discoveredTime)) return discoveredTime;

  const publishedTime = new Date(article.publishedAt ?? "").getTime();
  return Number.isNaN(publishedTime) ? 0 : publishedTime;
}
