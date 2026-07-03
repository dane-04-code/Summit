/**
 * Repository selection. SQLite on native; the in-memory store on web (no native
 * SQLite there). The native/web split happens at module resolution via
 * `createRepository` (Metro picks `createRepository.native.ts` on device and the
 * bare `createRepository.ts` everywhere else), so `expo-sqlite` never enters the
 * web bundle. A single instance is reused for the app's lifetime.
 */

import type { Repository } from './repository';
import { createRepository } from './createRepository';

let instance: Repository | null = null;

export function getRepository(): Repository {
  if (!instance) instance = createRepository();
  return instance;
}

/** Test seam — drop the cached instance. */
export function __resetRepository(): void {
  instance = null;
}

export type { Repository };
