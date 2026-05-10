import { lstat, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import MiniSearch from "minisearch";
import type { Options as MiniSearchOptions } from "minisearch";
import { indexFilePath, metaFilePath, projectsDir, remindDataDir } from "../paths.js";
import { indexFile } from "./builder.js";
import type { IndexDoc, SessionRecord, StoreMeta } from "./types.js";

const STORE_VERSION = 1;

const MINISEARCH_OPTIONS: MiniSearchOptions<IndexDoc> = {
  fields: ["content", "toolNames", "cwd"],
  storeFields: ["sessionId", "ts", "role", "cwd", "gitBranch", "hasError", "toolNames", "content"],
  searchOptions: {
    boost: { content: 2, toolNames: 1.5, cwd: 1 },
    fuzzy: (term) => (term.length >= 5 ? 0.2 : false),
    prefix: (term) => term.length >= 4,
    combineWith: "OR",
  },
};

export type RebuildStats = {
  filesScanned: number;
  filesParsed: number;
  filesSkippedUnchanged: number;
  docsIndexed: number;
  sessionsTracked: number;
  ms: number;
};

export class Store {
  private mini: MiniSearch<IndexDoc>;
  private meta: StoreMeta;
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private refreshPromise: Promise<RebuildStats> | null = null;

  constructor() {
    this.mini = new MiniSearch<IndexDoc>(MINISEARCH_OPTIONS);
    this.meta = emptyMeta();
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = this.doLoad();
    try {
      await this.loadPromise;
    } finally {
      this.loadPromise = null;
    }
  }

  private async doLoad(): Promise<void> {
    const indexPath = indexFilePath();
    const metaPath = metaFilePath();
    try {
      const [indexJson, metaJson] = await Promise.all([
        readFile(indexPath, "utf8"),
        readFile(metaPath, "utf8"),
      ]);
      const parsedMeta = JSON.parse(metaJson) as StoreMeta;
      if (parsedMeta.version === STORE_VERSION) {
        this.mini = MiniSearch.loadJSON<IndexDoc>(indexJson, MINISEARCH_OPTIONS);
        this.meta = parsedMeta;
      }
    } catch {
      this.mini = new MiniSearch<IndexDoc>(MINISEARCH_OPTIONS);
      this.meta = emptyMeta();
    }
    this.loaded = true;
  }

  async refresh(): Promise<RebuildStats> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.doRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefresh(): Promise<RebuildStats> {
    await this.load();
    const t0 = Date.now();
    const root = projectsDir();

    let filesScanned = 0;
    let filesParsed = 0;
    let filesSkippedUnchanged = 0;
    let docsIndexed = 0;

    let projects: string[];
    try {
      projects = await readdir(root);
    } catch {
      return finalize({
        filesScanned,
        filesParsed,
        filesSkippedUnchanged,
        docsIndexed,
        sessionsTracked: Object.keys(this.meta.sessions).length,
        ms: Date.now() - t0,
      });
    }

    const seenFiles = new Set<string>();

    for (const p of projects) {
      const dir = join(root, p);
      try {
        const dirStat = await lstat(dir);
        if (!dirStat.isDirectory() || dirStat.isSymbolicLink()) continue;
      } catch {
        continue;
      }
      let entries: string[];
      try {
        entries = await readdir(dir);
      } catch {
        continue;
      }
      for (const f of entries) {
        if (!f.endsWith(".jsonl")) continue;
        const full = join(dir, f);
        let mtimeMs: number;
        try {
          const ls = await lstat(full);
          if (ls.isSymbolicLink()) continue;
          if (!ls.isFile()) continue;
          mtimeMs = ls.mtimeMs;
        } catch {
          continue;
        }
        filesScanned++;
        seenFiles.add(full);

        const prior = this.meta.files[full];
        if (prior && prior.mtimeMs === mtimeMs) {
          filesSkippedUnchanged++;
          continue;
        }

        if (prior) {
          this.removeDocs(prior.docIds);
          delete this.meta.sessions[prior.sessionId];
        }

        const result = await safeIndex(full);
        if (!result) continue;

        const docIds: string[] = [];
        for (const doc of result.docs) {
          if (this.mini.has(doc.id)) this.mini.discard(doc.id);
          this.mini.add(doc);
          docIds.push(doc.id);
        }

        this.meta.files[full] = {
          mtimeMs,
          sessionId: result.session.sessionId,
          docIds,
        };
        this.meta.sessions[result.session.sessionId] = result.session;

        filesParsed++;
        docsIndexed += result.docs.length;
      }
    }

    for (const knownPath of Object.keys(this.meta.files)) {
      if (!seenFiles.has(knownPath)) {
        const fileMeta = this.meta.files[knownPath];
        if (fileMeta) {
          this.removeDocs(fileMeta.docIds);
          delete this.meta.sessions[fileMeta.sessionId];
        }
        delete this.meta.files[knownPath];
      }
    }

    this.meta.builtAt = new Date().toISOString();
    await this.persist();

    return finalize({
      filesScanned,
      filesParsed,
      filesSkippedUnchanged,
      docsIndexed,
      sessionsTracked: Object.keys(this.meta.sessions).length,
      ms: Date.now() - t0,
    });
  }

  private removeDocs(ids: string[]): void {
    for (const id of ids) {
      if (this.mini.has(id)) this.mini.discard(id);
    }
  }

  private async persist(): Promise<void> {
    const dir = remindDataDir();
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const indexPath = indexFilePath();
    const metaPath = metaFilePath();
    await mkdir(dirname(indexPath), { recursive: true, mode: 0o700 });

    const indexTmp = indexPath + ".tmp";
    const metaTmp = metaPath + ".tmp";
    await writeFile(indexTmp, JSON.stringify(this.mini.toJSON()), {
      encoding: "utf8",
      mode: 0o600,
    });
    await writeFile(metaTmp, JSON.stringify(this.meta), {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(indexTmp, indexPath);
    await rename(metaTmp, metaPath);
  }

  search(query: string, options: SearchOptions = {}): SearchResult[] {
    if (!query.trim()) return [];
    const limit = options.limit ?? 10;

    const sinceTs = options.sinceDays
      ? new Date(Date.now() - options.sinceDays * 86400_000).toISOString()
      : null;

    const projectFilter = options.project?.toLowerCase();

    const raw = this.mini.search(query, {
      filter: (r) => {
        if (sinceTs && typeof r.ts === "string" && r.ts < sinceTs) return false;
        if (projectFilter) {
          const cwd = typeof r.cwd === "string" ? r.cwd.toLowerCase() : "";
          if (!cwd.includes(projectFilter)) return false;
        }
        return true;
      },
    });

    return raw.slice(0, limit).map((r) => ({
      id: r.id as string,
      sessionId: r.sessionId as string,
      score: r.score,
      ts: (r.ts as string) ?? "",
      role: (r.role as "user" | "assistant") ?? "user",
      cwd: (r.cwd as string) ?? "",
      gitBranch: (r.gitBranch as string) ?? "",
      hasError: r.hasError === 1,
      content: (r.content as string) ?? "",
    }));
  }

  getSession(sessionId: string): SessionRecord | null {
    const exact = this.meta.sessions[sessionId];
    if (exact) return exact;
    for (const sid of Object.keys(this.meta.sessions)) {
      if (sid.startsWith(sessionId)) {
        return this.meta.sessions[sid] ?? null;
      }
    }
    return null;
  }

  resolveSessionId(idOrPrefix: string): string | null {
    if (this.meta.sessions[idOrPrefix]) return idOrPrefix;
    for (const sid of Object.keys(this.meta.sessions)) {
      if (sid.startsWith(idOrPrefix)) return sid;
    }
    return null;
  }

  getMessage(messageUuid: string): IndexedMessage | null {
    const stored = this.mini.getStoredFields(messageUuid);
    if (!stored) return null;
    return {
      messageUuid,
      sessionId: (stored.sessionId as string) ?? "",
      ts: (stored.ts as string) ?? "",
      role: (stored.role as "user" | "assistant") ?? "user",
      hasError: stored.hasError === 1,
      content: (stored.content as string) ?? "",
    };
  }

  getSessionMessages(sessionId: string): IndexedMessage[] {
    const fileMeta = Object.values(this.meta.files).find((f) => f.sessionId === sessionId);
    if (!fileMeta) return [];
    const out: IndexedMessage[] = [];
    for (const id of fileMeta.docIds) {
      const m = this.getMessage(id);
      if (m) out.push(m);
    }
    out.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
    return out;
  }

  listSessions(): SessionRecord[] {
    return Object.values(this.meta.sessions);
  }
}

export type IndexedMessage = {
  messageUuid: string;
  sessionId: string;
  ts: string;
  role: "user" | "assistant";
  hasError: boolean;
  content: string;
};

export type SearchOptions = {
  limit?: number;
  sinceDays?: number;
  project?: string;
};

export type SearchResult = {
  id: string;
  sessionId: string;
  score: number;
  ts: string;
  role: "user" | "assistant";
  cwd: string;
  gitBranch: string;
  hasError: boolean;
  content: string;
};

function emptyMeta(): StoreMeta {
  return { version: STORE_VERSION, builtAt: "", files: {}, sessions: {} };
}

async function safeIndex(filePath: string) {
  try {
    return await indexFile(filePath);
  } catch {
    return null;
  }
}

function finalize(stats: RebuildStats): RebuildStats {
  return stats;
}
