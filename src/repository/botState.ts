let currentChannelId: string | null = null

export const setChannelId = (channelId: string | null) => {
	currentChannelId = channelId
}

export const getChannelId = () => {
	return currentChannelId
}
