# Please Stand Up

A Discord bot that speaks short spoken notices in a voice channel when members join, leave or go AFK.

## Language

**Announcement**:
The spoken sentence for one voice-channel event (join, leave, AFK), composed from a Speech Template and member names or Aliases.
_Avoid_: message, notification

**Speech Template**:
A sentence pattern with a `{name}` placeholder that an Announcement is built from. Join and leave templates are customizable per bot; others are built in.
_Avoid_: script, phrase

**Alias**:
The name the bot speaks for a member instead of their Discord display name.
_Avoid_: nickname

**Speech**:
The synthesized audio of one Announcement.
_Avoid_: audio, voice line

**TTS Provider**:
A pluggable service that turns an Announcement's text into Speech. The bot depends only on the TTS Provider contract, never on a specific vendor.
_Avoid_: TTS API, engine

**Delivery**:
The attempt to join the target voice channel and play Speech for an Announcement, retried a bounded number of times, then skipped if it keeps failing.
_Avoid_: playback, send

**Speaker Queue**:
The ordered list of pending Announcements waiting for Delivery.
_Avoid_: queue (alone)

## Relationships

- An **Announcement** is built from a **Speech Template** and zero or more **Aliases**
- A **TTS Provider** produces one **Speech** per **Announcement**
- A **Delivery** plays one **Speech**; a skipped **Delivery** never blocks the **Speaker Queue**
