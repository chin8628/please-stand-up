import { VoiceState } from 'discord.js'

export const isPleaseStandUp = (newState: VoiceState): boolean => newState.member.id === process.env.DISCORD_APP_ID
