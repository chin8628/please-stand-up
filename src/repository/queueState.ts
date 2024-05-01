import logger from 'npmlog'

export enum QueueState {
	IDLE = 'IDLE',
	PROCESSING = 'PROCESSING',
}

let queueState: QueueState = QueueState.IDLE

export const getQueueState = () => queueState

export const setQueueState = (state: QueueState) => {
	logger.info('queue state', 'Queue state changed to', state)
	queueState = state
}
