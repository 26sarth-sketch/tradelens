/**
 * Inline <script> that runs during HTML parsing (before first paint) without React's
 * dev warning about rendering scripts. Per the Next.js "preventing flash" guide:
 * executable on the server render, inert text/plain on the client.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
