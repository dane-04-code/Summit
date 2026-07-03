/**
 * Native (iOS/Android) repository factory: the persistent SQLite store.
 *
 * `expo-sqlite` is imported here and nowhere reachable from the web bundle, so
 * Metro only pulls the native module (and its `.wasm` worker asset) into the
 * native builds that can actually resolve it. Web resolves `createRepository.ts`
 * instead. A runtime `Platform.OS` guard does NOT achieve this — Metro bundles
 * any statically-required module regardless of the guard around it.
 */

import type { Repository } from './repository';
import { SqliteRepository } from './sqlite';

export function createRepository(): Repository {
  return new SqliteRepository();
}
