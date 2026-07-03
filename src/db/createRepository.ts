/**
 * Default / web repository factory. No native SQLite here, so use the in-memory
 * store. Metro resolves the platform-specific `createRepository.native.ts` on
 * iOS/Android; this bare module is what web (and Node/tests) fall back to, which
 * is precisely why `expo-sqlite` never enters the web bundle.
 */

import type { Repository } from './repository';
import { InMemoryRepository } from './memory';

export function createRepository(): Repository {
  return new InMemoryRepository();
}
