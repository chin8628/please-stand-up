# 07: Verify the Stable Bot End to End

**What to build:** The full bot stability contract is protected by deterministic automated checks: durable settings, stable announcement reduction, recoverable voice delivery, public recovery controls, and bounded shutdown all work together without Discord credentials.

**Blocked by:** 02: Persist Bot Settings Atomically; 03: Reduce Voice-State Activity to Stable Announcements; 04: Make Speech Delivery Recoverable; 05: Add Public Runtime Status and Queue Recovery; 06: Shut Down Voice Work Predictably.

**Status:** ready-for-agent

- [ ] The full Jest suite deterministically exercises the agreed stability contract through Discord and voice adapters/mocks.
- [ ] Typecheck, lint, tests, production build, and container build all pass in CI.
- [x] Documentation reflects the shipped command behavior and recovery workflow.