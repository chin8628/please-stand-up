# 03: Reduce Voice-State Activity to Stable Announcements

**What to build:** Eligible Discord voice changes become typed announcements that respect current channel filters and reduce each member's debounce-window activity to a final stable result. Transient activity no longer creates contradictory speech, and the bounded queue remains deterministic.

**Blocked by:** 01: Establish the PNPM and Node 22 Runtime Baseline; 02: Persist Bot Settings Atomically.

**Status:** ready-for-agent

- [x] Bot events, first arrivals to empty channels, user-limited channels, and AFK channels remain ineligible for announcements.
- [x] A member whose activity returns to its initial state during the debounce window produces no announcement.
- [x] A stable channel switch produces the intended leave and join announcements without duplicate or stale speech.
- [x] Tests deterministically cover event classification, debounce reduction, batching, and the fixed queue limit.