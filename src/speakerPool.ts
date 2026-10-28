export type Assignment = {
	speakerId: string
	previousChannelId: string | null
}

export type SpeakerSnapshot = {
	speakerId: string
	channelId: string | null
	busy: boolean
}

type SpeakerSlot = {
	channelId: string | null
	busy: boolean
	idleSince: number
}

type Waiter = {
	channelId: string
	guildId: string
	resolve: (assignment: Assignment) => void
}

/**
 * Decides which Speaker occupies which voice channel. A channel has at most one Speaker.
 * A Speaker is "busy" from acquire() until release(); a busy Speaker is never taken away.
 */
export const createSpeakerPool = (
	speakerIds: string[],
	canServe: (speakerId: string, guildId: string) => boolean = () => true
) => {
	const slots = new Map<string, SpeakerSlot>(speakerIds.map((id) => [id, { channelId: null, busy: false, idleSince: 0 }]))
	let waiters: Waiter[] = []
	let tick = 0

	const entries = (guildId: string) => Array.from(slots.entries()).filter(([id]) => canServe(id, guildId))

	const tryAssign = (channelId: string, guildId: string): Assignment | null => {
		const candidates = entries(guildId)

		const inChannel = Array.from(slots.entries()).find(([, slot]) => slot.channelId === channelId)
		if (inChannel) {
			// Only the Speaker already in the channel may serve it, and only once it is free.
			const [id, slot] = inChannel
			if (slot.busy || !canServe(id, guildId)) return null
			slot.busy = true
			return { speakerId: id, previousChannelId: channelId }
		}

		const free = candidates.find(([, slot]) => !slot.busy && slot.channelId === null)
		const hop = candidates
			.filter(([, slot]) => !slot.busy)
			.sort(([, a], [, b]) => a.idleSince - b.idleSince)[0]
		const chosen = free ?? hop
		if (!chosen) return null

		const [id, slot] = chosen
		const previousChannelId = slot.channelId
		slot.channelId = channelId
		slot.busy = true
		return { speakerId: id, previousChannelId }
	}

	const flushWaiters = () => {
		const stillWaiting: Waiter[] = []
		for (const waiter of waiters) {
			const assignment = tryAssign(waiter.channelId, waiter.guildId)
			if (assignment) waiter.resolve(assignment)
			else stillWaiting.push(waiter)
		}
		waiters = stillWaiting
	}

	return {
		/** Resolves with the Speaker that must perform the next Delivery in the channel. */
		acquire: (channelId: string, guildId: string): Promise<Assignment> => {
			const assignment = tryAssign(channelId, guildId)
			if (assignment) return Promise.resolve(assignment)
			return new Promise((resolve) => waiters.push({ channelId, guildId, resolve }))
		},

		release: (speakerId: string, { keepChannel = true }: { keepChannel?: boolean } = {}): void => {
			const slot = slots.get(speakerId)
			if (!slot) return
			slot.busy = false
			slot.idleSince = ++tick
			if (!keepChannel) slot.channelId = null
			flushWaiters()
		},

		/** Frees the Speaker in the channel (it is about to disconnect). Returns its id, if any. */
		leaveChannel: (channelId: string): string | null => {
			const found = Array.from(slots.entries()).find(([, slot]) => slot.channelId === channelId)
			if (!found) return null
			found[1].channelId = null
			flushWaiters()
			return found[0]
		},

		getSpeakerIn: (channelId: string): string | null => {
			const found = Array.from(slots.entries()).find(([, slot]) => slot.channelId === channelId)
			return found ? found[0] : null
		},

		vacateAll: (): void => {
			slots.forEach((slot) => {
				slot.channelId = null
			})
			flushWaiters()
		},

		snapshot: (): SpeakerSnapshot[] =>
			Array.from(slots.entries()).map(([speakerId, slot]) => ({
				speakerId,
				channelId: slot.channelId,
				busy: slot.busy,
			})),
	}
}

export type SpeakerPool = ReturnType<typeof createSpeakerPool>
