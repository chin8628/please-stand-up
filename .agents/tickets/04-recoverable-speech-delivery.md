# 04: Make Speech Delivery Recoverable

**What to build:** The bot joins or moves to the target voice channel, waits for readiness, speaks, and remains connected afterward. Transient connection/TTS failures retry within a bound; exhausted failures are recorded and skipped so subsequent announcements continue. The bot disconnects once it is alone in its current channel.

**Blocked by:** 03: Reduce Voice-State Activity to Stable Announcements.

**Status:** ready-for-agent

- [x] Speech begins only after the target voice connection is ready, and audio resources are released after playback.
- [x] A transient delivery failure retries a bounded number of times before the announcement is skipped.
- [x] A skipped announcement cannot block later queued announcements, and its failure is available to operational status.
- [x] The bot remains in the last announced channel and disconnects when it is the only member there.
- [x] Tests cover successful delivery, retry exhaustion, continued queue processing, and disconnect behavior.