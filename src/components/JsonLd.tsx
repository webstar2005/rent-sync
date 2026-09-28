/**
 * Renders a schema.org graph as a JSON-LD script tag.
 *
 * The "<" escape is not decoration. JSON.stringify happily emits a raw "<" inside a string, so any
 * answer text that ever contained "</script>" would close this tag early and turn the rest of the
 * answer into markup the browser parses instead of data a crawler reads.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
