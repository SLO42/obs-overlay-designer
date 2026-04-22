import { del, get, keys, set } from "idb-keyval";
import type { Project, ProjectMeta } from "@obs/core";

const PROJECT_PREFIX = "project:";
const DEBOUNCE_MS = 400;

type PendingSave = {
  timer: ReturnType<typeof setTimeout>;
  project: Project;
  resolve: () => void;
  reject: (err: unknown) => void;
};

const pending = new Map<string, PendingSave>();

function projectKey(id: string): string {
  return `${PROJECT_PREFIX}${id}`;
}

/**
 * Strip fields that we don't want written to IndexedDB (per Task 3:
 * accessToken stays in exports but not at rest).
 */
function sanitizeForPersistence(project: Project): Project {
  if (!project.twitch) {
    return project;
  }
  // Drop accessToken from the twitch config before persisting.
  const { accessToken: _accessToken, ...restTwitch } = project.twitch;
  void _accessToken;
  return { ...project, twitch: restTwitch };
}

/**
 * Debounced per-project save into IndexedDB. Multiple rapid calls with the
 * same project id coalesce into a single write of the latest snapshot,
 * fired 400ms after the last call. The returned promise resolves when the
 * write actually lands.
 */
export function saveProject(project: Project): Promise<void> {
  const existing = pending.get(project.meta.id);
  if (existing) {
    clearTimeout(existing.timer);
    existing.project = project;
    return new Promise<void>((resolve, reject) => {
      existing.resolve = resolve;
      existing.reject = reject;
      existing.timer = setTimeout(() => void flush(project.meta.id), DEBOUNCE_MS);
    });
  }

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => void flush(project.meta.id), DEBOUNCE_MS);
    pending.set(project.meta.id, { timer, project, resolve, reject });
  });
}

async function flush(projectId: string): Promise<void> {
  const entry = pending.get(projectId);
  if (!entry) return;
  pending.delete(projectId);
  try {
    const toWrite = sanitizeForPersistence(entry.project);
    await set(projectKey(projectId), toWrite);
    entry.resolve();
  } catch (err) {
    entry.reject(err);
  }
}

/** Force any pending debounced write for `id` to happen immediately. */
export async function flushProject(projectId: string): Promise<void> {
  const entry = pending.get(projectId);
  if (!entry) return;
  clearTimeout(entry.timer);
  await flush(projectId);
}

export async function loadProject(projectId: string): Promise<Project | null> {
  const value = (await get(projectKey(projectId))) as Project | undefined;
  return value ?? null;
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const allKeys = await keys();
  const metas: ProjectMeta[] = [];
  for (const key of allKeys) {
    if (typeof key !== "string" || !key.startsWith(PROJECT_PREFIX)) continue;
    const value = (await get(key)) as Project | undefined;
    if (value?.meta) {
      metas.push(value.meta);
    }
  }
  // Most-recently-updated first tends to be what pickers want.
  metas.sort((a, b) => b.updatedAt - a.updatedAt);
  return metas;
}

export async function deleteProject(projectId: string): Promise<void> {
  const entry = pending.get(projectId);
  if (entry) {
    clearTimeout(entry.timer);
    pending.delete(projectId);
    // Resolve any pending save promise so callers don't hang.
    entry.resolve();
  }
  await del(projectKey(projectId));
}
