# 05: Add Public Runtime Status and Queue Recovery

**What to build:** All members can run a safe typed command set. `/status` reports the current runtime condition ephemerally; `/reset queue` cancels current and pending work, disconnects the bot, and restores idle operation. `/start` and `/stop` are removed, and unknown or failed commands return safe responses.

**Blocked by:** 04: Make Speech Delivery Recoverable.

**Status:** ready-for-agent

- [x] `/status` returns an ephemeral snapshot of queue depth, active work, connection/channel state, and the most recent delivery failure.
- [x] `/reset queue` invalidates pending work, stops active speech, destroys the connection, and reports the recovery result.
- [x] Removed start/stop commands are no longer registered or dispatched.
- [x] Unknown commands and command execution errors cannot cause an unhandled exception or double response.
- [x] Tests cover status, successful reset recovery, command removal, unknown commands, and command failures.