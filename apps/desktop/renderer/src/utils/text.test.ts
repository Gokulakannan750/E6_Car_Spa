import { describe, it, expect } from 'vitest';
import { capitalizeSentence, normalizeSentenceInput } from './text';

describe('Sentence-Case Text Normalization Utility', () => {
	it('normalizes single lowercase word to start with uppercase', () => {
		expect(capitalizeSentence('erode')).toBe('Erode');
		expect(capitalizeSentence('black')).toBe('Black');
		expect(capitalizeSentence('honda')).toBe('Honda');
	});

	it('normalizes multi-word input to sentence case without altering subsequent words', () => {
		expect(capitalizeSentence('gokul kannan')).toBe('Gokul kannan');
		expect(capitalizeSentence('car wash required')).toBe('Car wash required');
		expect(capitalizeSentence('full body foam wash and polish')).toBe('Full body foam wash and polish');
	});

	it('does NOT convert to Title Case ("gokul kannan" -> "Gokul kannan", NOT "Gokul Kannan")', () => {
		const result = capitalizeSentence('gokul kannan');
		expect(result).toBe('Gokul kannan');
		expect(result).not.toBe('Gokul Kannan');
	});

	it('preserves existing uppercase characters and acronyms', () => {
		expect(capitalizeSentence('BMW M340i')).toBe('BMW M340i');
		expect(capitalizeSentence('Gokul kannan')).toBe('Gokul kannan');
		expect(capitalizeSentence('Anna Salai, Chennai')).toBe('Anna Salai, Chennai');
		expect(capitalizeSentence('CR-V 2.0')).toBe('CR-V 2.0');
	});

	it('handles leading and trailing whitespace safely while capitalizing the first letter', () => {
		expect(capitalizeSentence('   erode')).toBe('   Erode');
		expect(capitalizeSentence('  car wash required  ')).toBe('  Car wash required  ');
	});

	it('handles empty strings, null, and undefined safely', () => {
		expect(capitalizeSentence('')).toBe('');
		expect(capitalizeSentence('   ')).toBe('   ');
		expect(capitalizeSentence(null)).toBe('');
		expect(capitalizeSentence(undefined)).toBe('');
	});

	it('works identically through normalizeSentenceInput helper', () => {
		expect(normalizeSentenceInput('gokul kannan')).toBe('Gokul kannan');
		expect(normalizeSentenceInput('erode')).toBe('Erode');
	});
});
