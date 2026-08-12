/**
 * Per-navigation entrance. Re-mounts on every route change, so each page fades
 * in — the remount is what replays the CSS animation.
 *
 * Opacity-only on purpose: a transform here would create a containing block and
 * break the site's `position: fixed` header/overlays.
 *
 * Plain CSS rather than Framer Motion, and therefore a server component: this
 * sits above every page in the group, so importing an animation library here
 * dragged ~43KB onto every route in the site to run a single fade.
 *
 * IT LIVES IN `(site)`, NOT AT THE APP ROOT. At the root it also wrapped
 * `/admin`, where a 400ms fade from `opacity: 0` is not an entrance — it is
 * 400ms of the page not being there, on top of a server round trip, on every
 * single click. That was most of what "laggy between clicks" meant. The admin
 * is a tool; it should appear, not arrive.
 *
 * Being inside the group's layout rather than above it also means the header and
 * footer no longer fade on every navigation — only the page content does, which
 * is what the fade was ever for.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
