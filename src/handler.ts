import { userMovedToAFKHandler } from './handlers/userMovedToAFK'
import { userJoinChannel } from './handlers/userJoinChannel'
import { userLeftChannel } from './handlers/userLeftChannel'
import { VoiceState } from 'discord.js'

export const handler = (prevState: VoiceState, newState: VoiceState): void => {
	const isUserMovedToAFK = prevState.channelId && newState.guild.afkChannelId === newState.channelId
	if (isUserMovedToAFK) {
		userMovedToAFKHandler(prevState, newState)
		return
	}

	const isUserSwitchFromAFK =
		prevState.channelId &&
		newState.channelId &&
		prevState.channelId !== newState.channelId &&
		prevState.guild.afkChannelId === prevState.channelId &&
		newState.guild.afkChannelId !== newState.channelId
	if (isUserSwitchFromAFK) {
		userJoinChannel(newState)
		return
	}

	const isSwitchChannel = prevState.channelId && newState.channelId && prevState.channelId !== newState.channelId
	if (isSwitchChannel) {
		userLeftChannel(prevState)
		userJoinChannel(newState)
		return
	}

	const isLeftChannel = !newState.channelId && prevState.channelId
	if (isLeftChannel) {
		userLeftChannel(prevState)
		return
	}

	const isJoinChannel = !prevState.channelId && newState.channelId
	if (isJoinChannel) {
		userJoinChannel(newState)
		return
	}
}
