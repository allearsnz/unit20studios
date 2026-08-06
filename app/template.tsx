/**
 * Per-navigation entrance. Re-mounts on every route change, so each page fades
 * in — the remount is what replays the CSS animation.
 *
 * Opacity-only on purpose: a transform here would create a containing block and
 * break the site's `position: fixed` header/overlays.
 *
 * Plain CSS rather than Framer Motion, and therefore a server component: this
 * sits at the app root, so importing an animation library here dragged ~43KB
 * onto every route in the site to run a single fade.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
