export enum QueueState {
	IDLE = 'IDLE',
	PROCESSING = 'PROCESSING',
}

let queueState: QueueState = QueueState.IDLE

export const getQueueState = () => queueState

export const setQueueState = (state: QueueState) => {
	queueState = state
}
