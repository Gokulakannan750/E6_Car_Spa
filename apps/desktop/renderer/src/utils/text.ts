/**
 * Normalizes user-entered human text to Sentence Case / first-letter capitalization.
 * The first non-whitespace character is converted to uppercase, while the rest of
 * the string retains its natural casing.
 *
 * Examples:
 *   "gokul kannan"      -> "Gokul kannan"
 *   "erode"             -> "Erode"
 *   "black"             -> "Black"
 *   "car wash required" -> "Car wash required"
 *   "   leading space"  -> "   Leading space"
 *   ""                  -> ""
 *   "BMW M340i"         -> "BMW M340i"
 *   "already Capital"   -> "Already Capital"
 */
export function capitalizeSentence(text: string | null | undefined): string {
	if (!text) return text ?? '';
	// Capitalize first alphabetic character following any leading whitespace
	return text.replace(/^(\s*)([a-z\p{Ll}])/u, (_, space, char) => `${space}${char.toUpperCase()}`);
}

/**
 * Normalizes an input value on blur or submit.
 * Safe to use with React state setters or form onChange handlers.
 */
export function normalizeSentenceInput(value: string | null | undefined): string {
	return capitalizeSentence(value);
}
