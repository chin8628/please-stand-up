import logger from 'npmlog'

let currentChannelId: string | null = null

export const setChannelId = (channelId: string | null) => {
	logger.info('channelId', 'ChannelId changed to', channelId)
	currentChannelId = channelId
}

export const getChannelId = () => {
	return currentChannelId
}
