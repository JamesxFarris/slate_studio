// Tiny className concatenator. Avoids pulling in `clsx` to keep the lockfile
// untouched. Drops falsy values, dedupes whitespace.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}
