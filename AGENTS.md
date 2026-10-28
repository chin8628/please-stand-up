# Please Stand Up

Discord bot that speaks short TTS notices in a voice channel when members join, leave, or go AFK. Domain vocabulary lives in [CONTEXT.md](CONTEXT.md); use those terms (Announcement, Speech, Delivery, Speaker, Speaker Queue, ...) in code, comments, and discussion.

## Stack

TypeScript, discord.js 14, @discordjs/voice, Jest (babel-jest), ESLint + Prettier, pnpm 9, Node 22 (`.nvmrc`). Deployed with Docker / docker-compose (`./data` is mounted for `settings.json`).

## Commands

- `pnpm dev` - run with ts-node-dev
- `pnpm test` / `pnpm typecheck` / `pnpm lint` - husky pre-push and CI run these
- `pnpm build` then `pnpm start:prod`
- `pnpm update-command` - register slash commands with Discord (needs `TOKENS`/`TOKEN`, `PRIMARY_DISCORD_APP_ID`)

## Architecture (src/)

- `index.ts` - logs in every Speaker (`startSpeakers.ts`, tokens from `config.ts`), wires voice/command listeners on the Primary Speaker only, selects the TTS provider from `TTS_PROVIDER`, wires `voiceStateUpdate` and `interactionCreate`, handles graceful shutdown.
- `handler.ts` + `handlers/` - classify a voice-state change (join, leave, switch, AFK) and enqueue events. Skips: first member alone, user-limited channels, AFK channel.
- `speakerQueue.ts` - one queue guarded by a mutex. Debounces, collapses join+leave of the same member, batches same-type events per channel into one Announcement. Channels are delivered in parallel (one in-flight Delivery per channel; events for a busy channel stay queued so they batch). `Disconnect` events free a channel's Speaker once only the Speaker remains.
- `speakerPool.ts` - pure logic deciding which Speaker serves a channel: same-channel Speaker, else a Speaker in no channel, else hop the longest-idle one, else wait. `speakers.ts` is the registry (clients, per-Speaker voice adapter, pool singleton).
- `botAction.ts` - joins the voice channel as a given Speaker (voice `group` = Speaker id), synthesizes via the TTS provider, plays audio; 3 delivery attempts, then skips.
- `tts/` - pluggable `TtsProvider` (`google-cloud` default, `translate`).
- `repository/` - `settings.ts` persists aliases and join/leave templates atomically to `${BOT_DATA_DIR:-./data}/settings.json`; `queueState.ts` holds the queue's in-memory state.
- `slashCommands.ts` / `commands.ts` - `/setjointemplate`, `/setlefttemplate`, `/callme`, `/leave`, `/status`, `/reset`.

## Multiple Speakers (branch `multi-bot`, implemented)

Decisions made (see CONTEXT.md for terms):

- One process hosts N Discord clients, one per **Speaker**. Tokens come from `TOKENS=a,b,c` (legacy single `TOKEN` still works; run in `node` 22 via `~/.nvm` if `node` is missing from PATH). The first is the **Primary Speaker**.
- Only the Primary Speaker listens to voice-state events and handles/registers slash commands. `DISCORD_APP_ID` is renamed `PRIMARY_DISCORD_APP_ID`. Every Speaker's user ID is ignored as an event source.
- Each Speaker occupies at most one channel; no two Speakers share a channel. A Speaker stays until only Speakers remain in its channel, then returns to the pool.
- If all Speakers are busy, the longest-idle (not speaking) Speaker hops to the new channel. Announcements are never dropped. The channel it left stays unclaimed until its next event. If every Speaker is mid-speech, the Announcement waits.
- Deliveries run in parallel across channels, ordered within a channel; existing debounce and batching are kept.
- `/leave` and `/reset` apply to all Speakers; `/status` lists each Speaker.
- Non-primary login failure: warn and continue. Primary failure: fatal.
- Scope: a single Discord server. Keep state keyed so multi-server support can follow later.

## Conventions

- Match surrounding style (tabs, no semicolons, single quotes); log with `npmlog`.
- Tests sit next to sources as `*.test.ts`; mock Discord objects with plain objects cast to the type.
- Keep CONTEXT.md a glossary only; record hard-to-reverse decisions as ADRs in `docs/adr/`.
