import type { IntroSurface } from './weave-timeline'

/**
 * Playback policy for the brand intro, decided before first paint by a tiny
 * inline script so the page never flashes (no landing page before the black
 * stage, no black stage for visitors who should go straight to the page).
 *
 * Plays every time Weavly is opened, and can always be skipped:
 * - landing:   every full load of `/` (including reloads), unless it is a
 *              #hash deep link or a navigation from another Weavly page
 * - app-login: every launch of the installed app (standalone display mode) on
 *              `/login`, but not when arriving from inside the app (e.g. after logout)
 * Never plays with reduced motion, Save-Data, no WebGL2, or when returning via
 * back/forward. `?intro=1` forces it (demos/QA); `?intro=0` suppresses it.
 *
 * The script only sets `data-weavly-intro` on <html> and exposes a small
 * handle on `window.__weavlyIntro`. The page underneath is fully rendered and
 * usable; any interaction before the animation starts, or a slow start,
 * simply removes the stage.
 */

export const INTRO_ATTRIBUTE = 'data-weavly-intro'
export const INTRO_LEAVING_ATTRIBUTE = 'data-weavly-intro-leaving'
export const INTRO_START_TIMEOUT_MS = 1500

export type IntroHandle = {
    surface: IntroSurface
    state: 'pending' | 'running' | 'done'
    /** Stop listening for early interactions and cancel the start watchdog. */
    release: () => void
    /** Remove the stage (short fade) and never start. */
    abort: () => void
}

export type IntroWindow = Window & { __weavlyIntro?: IntroHandle }

const SCRIPT = `(function(surface){
var d=document.documentElement,w=window;
var paint=function(c){var b=document.body;d.style.backgroundColor=c;if(b){b.style.backgroundColor=c;b.style.transition=c?"none":""}};
try{
var q=location.search;
if(/[?&]intro=0(?:&|$)/.test(q))return;
var forced=/[?&]intro=1(?:&|$)/.test(q);
if(typeof w.WebGL2RenderingContext==="undefined")return;
var mq=function(m){return !!(w.matchMedia&&w.matchMedia(m).matches)};
if(mq("(prefers-reduced-motion: reduce)"))return;
if(!forced){
var c=navigator.connection;if(c&&c.saveData)return;
var nav=w.performance&&w.performance.getEntriesByType?w.performance.getEntriesByType("navigation")[0]:null;
if(nav&&nav.type==="back_forward")return;
if(document.referrer&&document.referrer.indexOf(location.origin+"/")===0)return;
if(surface==="landing"&&location.hash)return;
if(surface==="app-login"&&!(mq("(display-mode: standalone)")||mq("(display-mode: minimal-ui)")||mq("(display-mode: fullscreen)")||navigator.standalone===true))return;
}
if(surface==="app-login"&&d.style)paint("rgb(7,7,6)");
d.setAttribute("${INTRO_ATTRIBUTE}",surface);
var link=document.createElement("link");link.rel="preload";link.as="image";link.href="/images/WeavlyLogo.png";document.head.appendChild(link);
var evs=["keydown","wheel","touchstart","pointerdown"],timer;
var api=w.__weavlyIntro={surface:surface,state:"pending"};
var early=function(){if(api.state==="pending")api.abort()};
api.release=function(){clearTimeout(timer);for(var i=0;i<evs.length;i++)w.removeEventListener(evs[i],early,true)};
api.abort=function(){if(api.state==="done")return;api.state="done";api.release();if(d.style&&d.style.backgroundColor)paint("rgb(244,243,236)");d.setAttribute("${INTRO_LEAVING_ATTRIBUTE}","");setTimeout(function(){d.removeAttribute("${INTRO_ATTRIBUTE}");d.removeAttribute("${INTRO_LEAVING_ATTRIBUTE}");if(d.style)paint("")},200)};
for(var i=0;i<evs.length;i++)w.addEventListener(evs[i],early,true);
timer=setTimeout(function(){if(api.state==="pending")api.abort()},${INTRO_START_TIMEOUT_MS});
}catch(e){d.removeAttribute("${INTRO_ATTRIBUTE}");if(d.style)paint("")}
})`

/** Static inline script (no user input) that decides whether the intro plays. */
export function buildIntroPrePaintScript(surface: IntroSurface): string {
    return `${SCRIPT}(${JSON.stringify(surface)});`
}
