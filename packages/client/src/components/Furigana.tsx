import type { FuriganaSegment } from "@pimsleursim/shared";

interface Props {
  text: string;
  segments?: FuriganaSegment[];
}

// Renders `text` with hiragana readings above kanji using native <ruby>/<rt>
// markup. Falls back to plain text when no (valid) segments are available —
// e.g. non-Japanese target languages, or older cached vocab from before this
// field existed.
export function Furigana({ text, segments }: Props) {
  if (!segments || segments.length === 0) return <>{text}</>;

  return (
    <>
      {segments.map((segment, i) =>
        segment.reading ? (
          <ruby key={i}>
            {segment.text}
            <rt>{segment.reading}</rt>
          </ruby>
        ) : (
          <span key={i}>{segment.text}</span>
        ),
      )}
    </>
  );
}
