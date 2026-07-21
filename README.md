# Summit

Summit is a private mobile operator cockpit for an AI agent you already run. It gives the user one calm place to message their agent, see what it is doing, receive useful proactive updates, and resume the conversation after the phone or network disappears.

## Current position

V1 is in release hardening, not connection architecture discovery.

- The native Hermes platform plugin is built and in alpha use. It supports native sessions, draft streaming, safe activity updates, reconnect, and durable settled-reply recovery.
- The relay is working reliably in active testing; recent use has not shown a meaningful disconnect problem.
- The iOS production build has been produced for TestFlight processing.
- The active V1 work is chat presentation and the small set of safe, useful operational signals Summit can receive from agent harnesses.

The product is not a developer console. A user should see the answer first, a brief indication of work in progress when useful, and an actionable notification when something needs attention. Raw model reasoning, tool arguments, terminal output, and a general-purpose remote UI protocol are explicitly out of scope.

## V1 path to release

1. Finish the mobile chat experience: message hierarchy, markdown/code treatment, composer reliability, and sensible loading/activity states.
2. Make the existing Hermes plugin output earn its place in daily use: streamed replies, safe activity labels, restart recovery, and one real proactive/cron delivery path.
3. Add a typed harness event only when a real use case needs it (for example, a compact cron result). Do not build a speculative plugin feature catalogue.
4. Run the real-device release checklist: pairing, background/restart recovery, push behaviour, permissions, and TestFlight install/update.
5. Complete store metadata/screenshots, widen TestFlight testing, and submit V1.

## Where to look

- [Current delivery status](docs/PROJECT_STATUS.md)
- [V1 launch plan](docs/LAUNCH_PLAN.md)
- [Agent, storage, and transport contract](AGENTS.md)
- [Native plugin connection plan](docs/PLUGIN_CONNECTION_PLAN.md)
- [Hermes plugin build record](docs/HERMES_PLUGIN_BUILD_PLAN.md)
- [Product brief](.agents/skills/nano-product-manager/product-brief.md)
- [Device test checklist](docs/TESTING.md)

## Development

```bash
npm install
npx expo start
npm test -- --runInBand
npx tsc --noEmit
```

The app lives here. The native Hermes platform plugin is maintained alongside it in the Summit-Hermes repository; its implementation is the source of truth for plugin-specific behaviour.
