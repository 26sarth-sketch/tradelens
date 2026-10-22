// A template (unlike a layout) is re-created on every navigation, so wrapping the page in `page-enter`
// replays the entrance animation each time you move between screens.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
