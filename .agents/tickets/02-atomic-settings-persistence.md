# 02: Persist Bot Settings Atomically

**What to build:** The bot starts with validated defaults when settings are absent or malformed, and safely persists aliases and custom join/leave templates across restarts. Existing alias data is intentionally not migrated.

**Blocked by:** 01: Establish the PNPM and Node 22 Runtime Baseline.

**Status:** ready-for-agent

- [x] A versioned settings document stores aliases and both configurable speech templates in the persistent data directory.
- [x] Missing, unreadable, or invalid settings result in documented defaults without preventing startup.
- [x] A settings update cannot leave a partially written settings document after an interrupted write.
- [x] Tests cover defaults, validation failures, template and alias persistence, and write recovery.