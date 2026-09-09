const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
  "nineteen", "twenty",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/**
 * Spells a count for running prose, where a numeral reads as a statistic.
 *
 * Shared because two pages now quote the roster size in a sentence, and a roster that grows
 * past the end of a hardcoded list should degrade to digits rather than print "undefined".
 */
export const spellNumber = (value: number): string => {
  if (!Number.isInteger(value) || value < 0) return String(value);
  if (value <= 20) return NUMBER_WORDS[value];
  if (value < 100) {
    const tens = TENS[Math.floor(value / 10)];
    const unit = value % 10;
    return unit === 0 ? tens : `${tens}-${NUMBER_WORDS[unit]}`;
  }
  return String(value);
};
