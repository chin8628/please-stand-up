import { VoiceState } from 'discord.js'
import { isSpeakerId } from '../speakers'

// True when the voice event was caused by one of our own Speakers.
export const isPleaseStandUp = (state: VoiceState): boolean => isSpeakerId(state.member?.id)
