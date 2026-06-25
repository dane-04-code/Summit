# Onboarding

One screen. Connect → chat. Nothing else.

Audience is technical self-hosters, so no welcome carousel and no tutorial — the goal is
**connected in under 2 minutes.**

## The flow

```
App opens
   │
   ▼
Connect screen ──── host + API key ──── [ Test connection ]
   │                                          │
   │                                  GET /v1/capabilities
   │                                          │
   ├─ success ──► store creds ──► empty chat (just the composer)
   │
   └─ failure ──► specific message, stay on screen
```

## The Connect screen

```
Connect your agent

  Host   my-hermes.home:8642
  Key    ••••••••••••

  ▸ Where do I find these?

       [ Test connection ]
```

- **Host** and **API key** — the only two inputs.
- **"Where do I find these?"** expands to the Hermes setup, because the #1 first-run
  failure is the API server not being started yet:
  ```
  In ~/.hermes/.env:
    API_SERVER_ENABLED=true
    API_SERVER_KEY=your-secret-key
    API_SERVER_PORT=8642

  Then start it:
    hermes gateway
  ```

## Connection results (be specific, never just "failed")

| Result | Message |
|---|---|
| Reached + valid | Store creds → go to chat |
| Can't reach host | "Couldn't reach `<host>`. Is the API server running? (`hermes gateway`)" |
| Reached, 401/403 | "Server's there, but the API key was rejected." |
| Reached, wrong shape | "Reached something, but it doesn't look like Hermes. Check host/port." |

## After connecting

Land directly in an **empty chat** — just the message composer. No hint, no overlay.
The first reply shows off the markdown rendering better than any tooltip.

## Notes

- Creds are stored on-device only (`expo-secure-store` / iOS Keychain). Nothing leaves
  the phone except calls to the user's own Hermes server.
- Reinstall or new phone = re-enter host + key once. No data is lost; Hermes holds it.
- A rejected key later (server-side rotation) reuses the same "rejected" path to prompt
  reconnect.
