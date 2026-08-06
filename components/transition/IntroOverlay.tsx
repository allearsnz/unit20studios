/**
 * First-load intro: black screen, the logo sits there while a bright diagonal
 * light sweeps across it once, then the overlay lifts. Once per session.
 *
 * This is deliberately a SERVER component with no JavaScript lifecycle. The
 * previous version started hidden and revealed itself from `useEffect`, so what
 * a real visitor saw was: content paints → they start reading → the screen goes
 * black for 2.6s. An intro that arrives after the content is not an intro, it
 * reads as a crash. Rendering it in the initial HTML makes it a genuine curtain.
 *
 * The gate is a synchronous inline script rather than React state because the
 * decision has to be made before the first paint — `sessionStorage` and the
 * reduced-motion query can't be read during SSR, and reading them after
 * hydration is exactly the bug above. No JS at all means `data-intro` is never
 * set and the overlay stays `display: none`, so a script failure can't leave
 * anyone stuck behind a black screen.
 */

// Runs before paint. Kept to one statement per line so it minifies predictably.
const GATE = `try{
var d=document.documentElement;
var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(reduce||sessionStorage.getItem('u20_intro')){d.dataset.intro='off';}
else{sessionStorage.setItem('u20_intro','1');d.dataset.intro='play';
var skip=function(){d.dataset.intro='off';};
addEventListener('pointerdown',skip,{once:true});
addEventListener('keydown',skip,{once:true});}
}catch(e){}`;

export function IntroOverlay() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: GATE }} />
      <div
        id="u20-intro"
        aria-hidden
        className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0a0a0a]"
      >
        <div className="intro-mask">
          <div className="intro-base" />
          <div className="intro-sweep" />
        </div>
      </div>
    </>
  );
}
