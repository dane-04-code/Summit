/**
 * The relay wire contract, re-exported from the repo's single source of truth.
 *
 * `export type *` keeps this a compile-time-only edge: nothing from
 * `protocol/protocol.ts` survives into the bundle, so the published plugin has
 * no dependency on the app repo's layout — but the types cannot drift from what
 * the relay and the app actually speak, which is the whole point.
 */
export type * from '../../protocol/protocol';
