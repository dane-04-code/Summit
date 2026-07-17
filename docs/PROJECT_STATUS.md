# Summit — Current Status and Release Path

_Last reviewed: 2026-07-17 · Source branch: `build/first-pages` · Latest reviewed commit: `2918972`._

This is the operational snapshot. [`LAUNCH_PLAN.md`](LAUNCH_PLAN.md) remains the one ordered launch
track; this document says what is genuinely built, what is verified, and what must happen next.

## Where we are

The core Summit flow is implemented: account onboarding, relay pairing, streaming chat, saved
threads, push plumbing, and action approvals. The production relay and connector have deployment
workflows. The relay security register is fully addressed in code.

The product is **implementation-complete enough for a real-device beta, not store-ready yet**.
No one has yet walked the complete cold path on a physical phone or uploaded a store build. That is
the next meaningful proof, ahead of additional features or visual work.

| Area | State | Evidence / remaining proof |
|---|---|---|
| Relay pairing and reconnect | Built and security-hardened | 256-bit app and connector credentials; re-pair existing development installs once. See [`RELAY_RISKS.md`](RELAY_RISKS.md). |
| Hermes relay chat | Built | Unit, relay, connector, and cross-platform connector-build checks have passed. Needs a physical-device end-to-end run. |
| OpenClaw relay chat and approvals | Built, live protocol work completed | Needs repeat testing against the intended production OpenClaw version before public support is promised. |
| Push notifications | Built; physical delivery unverified | Per-agent All activity / Needs attention / Off controls, privacy-safe tap-to-thread data, and local relay testing are in place. Real APNs/FCM delivery still needs a physical device and production credentials. |
| Account/authentication | Built | Needs real iOS and Android sign-in testing, including redirect/error cases. |
| App test gate | Not green as a whole | Focused relay tests pass and TypeScript passes. The last full root Jest run had four unrelated environment/time-out failures; resolve these before release. |
| Relay deployment | Automated on pushes to `main` and `build/first-pages` | Confirm the Cloudflare token and production deployment in GitHub Actions. |
| Connector release | Automated on pushes to `main` and `build/first-pages` | The approval-race fix at `2918972` fixes the previous CI test failure; confirm the resulting workflow run is green. |
| Store configuration | Partly configured | iOS has `com.dane.agentmessenger.siwa`; Android does **not** yet have an `android.package`, so Android production builds/submission are not ready. |

## The ordered path forward

Keep one track: prove the actual product before expanding scope.

1. **Close the automated release gate.** Confirm the current Connector workflow is green, then make
   the root TypeScript and Jest suite fully green under the supported Node version. Do not mask the
   four failing tests; identify whether each is a test timeout or a real runtime compatibility gap.
2. **Build remotely and walk the cold path on a real iPhone.** EAS can build in the cloud, so this
   does not require hosting the app locally. Start with a development build, use the deployed relay
   and a real Hermes/OpenClaw installation, then test: fresh account, pair, message, background
   the app, receive push, approve/deny, restart the app, and reconnect.
3. **Make the release identity explicit.** Before the first Android build, choose and reserve an
   immutable Android package name (recommended: `com.dane.agentmessenger.siwa`, matching iOS),
   create the Google Play Console app, and configure Android signing plus Expo's Google service
   account. Also verify Apple/Google sign-in and notification credentials on both platforms.
4. **Make the first thirty seconds and failure states clear.** Use findings from the real-device
   run to polish only pairing, loading, offline/relay-down messaging, and permission prompts.
5. **Prepare beta assets and compliance.** Final icon/name, screenshots, store copy, privacy
   disclosures, support/privacy URLs, and an accurate explanation that the relay carries traffic
   but agent keys stay on the user's server.
6. **Beta before public launch.** Send a TestFlight build and Play internal-test build to a small
   group of actual self-hosters. Fix the three highest-friction issues, then promote to review.

## What is deliberately not next

Do not start dashboards, social chat features, new framework support, or broad feature work before
the beta flow works. They do not make the core “pair → message → act from away from desk” journey
more reliable. OpenClaw already has a focused connector path; its public-support decision should be
based on beta evidence, not on adding more platform surface.

## Android versus iOS upload

For normal releases, Android is nearly as simple with EAS: build a production Android App Bundle
(`.aab`) and submit it with `eas submit --platform android`. The first Android release has a few
one-time steps iOS does not share: create the Play Console app, set the permanent package name,
create/upload a Google service-account key to EAS, complete the Play listing and required forms,
then upload initially to the internal-testing track. EAS documents that flow and the `.aab`
requirement [here](https://docs.expo.dev/submit/android/).

The equivalent iOS flow is also EAS-driven, but relies on the Apple bundle identifier, signing, and
App Store Connect setup. In practice, neither platform needs you to run the app server locally for
cloud builds; what requires a real device is validating sign-in, pairing, and push before release.

## Document ownership

- [`LAUNCH_PLAN.md`](LAUNCH_PLAN.md): ordered work; the next unchecked item is the work in flight.
- This file: factual readiness snapshot and release prerequisites.
- [`RELAY_RISKS.md`](RELAY_RISKS.md): security risks and their code-level status.
- [`TESTING.md`](TESTING.md): repeatable local/device verification loops.
- [`PUBLISHING_COPY.md`](PUBLISHING_COPY.md): store and launch copy drafts.
