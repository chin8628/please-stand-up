/**
 * Speech templates for multi-member announcements and special cases.
 * These templates are used when the customizable single-member templates don't apply.
 */

export const SPEECH_TEMPLATES = {
	/** Template for multiple members joining at once */
	multipleJoin: (names: string): string => `${names} เข้ามาจ้า`,

	/** Template for multiple members leaving at once */
	multipleLeft: (names: string): string => `${names} ออกไปแล้ว`,

	/** Template for multiple members going AFK at once */
	multipleAfk: (names: string): string => `${names} afk จ้า`,

	/** Template for single member going AFK */
	singleAfk: (name: string): string => `${name} afk จ้า`,

	/** Template for users who join and leave frequently (same user, same channel, multiple events) */
	frequentJoinLeave: (name: string): string => `เข้าออกทำเหี้ยอะไร ${name}`,
} as const

/** Connector word for joining multiple names (Thai: "and") */
export const NAME_CONNECTOR = ' และ '
