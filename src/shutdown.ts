export type ShutdownDependencies = {
	isSpeaking: () => boolean
	stopSpeaking: () => void
	disconnect: () => void
	close: () => void
}

const SHUTDOWN_GRACE_MS = 10_000

const waitForSpeechToFinish = async (isSpeaking: () => boolean): Promise<void> => {
	while (isSpeaking()) {
		await new Promise((resolve) => setTimeout(resolve, 100))
	}
}

export const createShutdownHandler = (dependencies: ShutdownDependencies, graceMs = SHUTDOWN_GRACE_MS) => {
	let isShuttingDown = false

	return async (): Promise<void> => {
		if (isShuttingDown) return
		isShuttingDown = true

		await Promise.race([
			waitForSpeechToFinish(dependencies.isSpeaking),
			new Promise((resolve) => setTimeout(resolve, graceMs)),
		])
		dependencies.stopSpeaking()
		dependencies.disconnect()
		dependencies.close()
	}
}