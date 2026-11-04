/**
 * How dark it is right now, 0 (day) to 1 (night). Written every frame by the day cycle, read by the ambience
 * (birds only sing in daylight). Deliberately free of three.js so the audio code can import it cheaply.
 */
export const dayState = { night: 0 };
