# 06: Shut Down Voice Work Predictably

**What to build:** On `SIGINT` or `SIGTERM`, the bot stops accepting announcements, gives current speech a bounded completion window, disconnects cleanly, and exits without hanging deployment or shutdown.

**Blocked by:** 04: Make Speech Delivery Recoverable.

**Status:** ready-for-agent

- [x] Shutdown stops accepting new voice-state work immediately.
- [x] Active speech is given a documented bounded grace period before forced disconnect.
- [x] The voice connection and runtime state are cleaned up on both graceful and timed-out shutdown paths.
- [x] Deterministic tests cover signal handling, grace-period completion, timeout, and idempotent repeated signals.