const RECENT_KEY = "timestream.recentRepos";
const MAX_RECENT = 12;

export interface RecentRepo {
  path: string;
  name: string;
  openedAt: number;
}

function folderName(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, "");
  const parts = trimmed.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export function loadRecentRepos(): RecentRepo[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RecentRepo[];
      if (Array.isArray(parsed)) {
        const list = parsed.filter(
          (item) =>
            item &&
            typeof item.path === "string" &&
            typeof item.name === "string" &&
            typeof item.openedAt === "number",
        );
        if (list.length > 0) return list;
      }
    }
  } catch {
    /* fall through to lastRepo migration */
  }

  const last = localStorage.getItem("timestream.lastRepo");
  if (!last) return [];
  const seeded: RecentRepo[] = [
    { path: last, name: folderName(last), openedAt: Date.now() },
  ];
  localStorage.setItem(RECENT_KEY, JSON.stringify(seeded));
  return seeded;
}

export function rememberRepo(path: string): RecentRepo[] {
  const next: RecentRepo = {
    path,
    name: folderName(path),
    openedAt: Date.now(),
  };
  const existing = loadRecentRepos().filter((item) => item.path !== path);
  const list = [next, ...existing].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  localStorage.setItem("timestream.lastRepo", path);
  return list;
}

export function removeRecentRepo(path: string): RecentRepo[] {
  const list = loadRecentRepos().filter((item) => item.path !== path);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  return list;
}
