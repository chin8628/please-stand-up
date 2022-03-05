const TAG_MAP = {
	"2089+": "chin",
	"9142": "chibi",
	"9611": "pongmile",
	"2895": "god",
	"2525": "pamai",
}

export function getNameByTagNumber(tag: string): string | undefined {
	return TAG_MAP[tag]
}
