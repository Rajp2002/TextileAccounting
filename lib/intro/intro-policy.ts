import type { IntroSurface } from './weave-timeline'
import { INTRO_TELEMETRY_PATH, type IntroStep } from './intro-telemetry'
import { STARTUP_INTRO_PREFERENCE_KEY, STARTUP_INTRO_PROBE_KEY, STARTUP_INTRO_SEEN_KEY } from './startup-preference'

/**
 * Playback policy for the brand intro, decided before first paint by a tiny
 * inline script so the page never flashes (no landing page before the black
 * stage, no black stage for visitors who should go straight to the page).
 *
 * Can always be skipped:
 * - landing:   every full load of `/` (including reloads), unless it is a
 *              #hash deep link or a navigation from another Weavly page
 * - app-login: every launch of the installed app. Settings can limit it to
 *              the first launch on this device or switch it off. Never plays
 *              when arriving from inside the app (e.g. after logout).
 * Never plays with reduced motion, Save-Data, no WebGL2, or when returning via
 * back/forward. `?intro=1` forces it (demos/QA); `?intro=0` suppresses it.
 *
 * The script only sets `data-weavly-intro` on <html> and exposes a small
 * handle on `window.__weavlyIntro`. The page underneath is fully rendered and
 * usable; any interaction before the animation starts, or a slow start,
 * simply removes the stage. In the installed app the handle also reports,
 * once, why the intro ended and when each start-up step was reached
 * (lib/intro/intro-telemetry.ts), so a launch that only shows black is
 * explained by the logs.
 */

export const INTRO_ATTRIBUTE = 'data-weavly-intro'
export const INTRO_LEAVING_ATTRIBUTE = 'data-weavly-intro-leaving'
export const INTRO_START_TIMEOUT_MS = 1500

// Inline in <head>: the login body may arrive before the intro stage or the
// external stylesheet. Runtime inline colours still win during the handoff.
export const APP_INTRO_PRE_PAINT_CSS = `html[data-weavly-intro="app-login"],html[data-weavly-intro="app-login"] body{background-color:#000;transition:none}`

export type IntroHandle = {
    surface: IntroSurface
    state: 'pending' | 'running' | 'done'
    /** Stop listening for early interactions and cancel the start watchdog. */
    release: () => void
    /** Remove the stage (short fade) and never start; `reason` is what the report says. */
    abort: (remember?: boolean, reason?: string) => void
    /** Remember an explicit skip or a completed installed-login introduction. */
    markSeen: () => void
    /** Note when a start-up step was reached (first time only). */
    mark?: (step: IntroStep) => void
    /** Installed app only: send why the intro ended, once (lib/intro/intro-telemetry.ts). */
    report?: (reason: string, detail?: string) => void
}

export type IntroWindow = Window & { __weavlyIntro?: IntroHandle }

const SCRIPT = `(function(surface){
var d=document.documentElement,w=window;
if(!surface||(w.__weavlyIntro&&w.__weavlyIntro.surface===surface))return;
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
if(surface==="app-login"){
var storage=w.localStorage,pref=storage.getItem(${JSON.stringify(STARTUP_INTRO_PREFERENCE_KEY)}),seen=storage.getItem(${JSON.stringify(STARTUP_INTRO_SEEN_KEY)});
if(pref==="never"||(pref==="first-launch"&&seen==="1"))return;
storage.setItem(${JSON.stringify(STARTUP_INTRO_PROBE_KEY)},"1");storage.removeItem(${JSON.stringify(STARTUP_INTRO_PROBE_KEY)});
}
}
if(surface==="app-login"&&d.style)paint("rgb(7,7,6)");
d.setAttribute("${INTRO_ATTRIBUTE}",surface);
var link=document.createElement("link");link.rel="preload";link.as="image";link.href="/images/WeavlyLogo.png";document.head.appendChild(link);
var evs=["keydown","wheel","touchstart","pointerdown"],timer;
var api=w.__weavlyIntro={surface:surface,state:"pending"};
var now=function(){var p=w.performance;return p&&p.now?Math.round(p.now()):-1},diag={s:surface,forced:!!forced,d:now()};
api.mark=function(step){if(!(step in diag))diag[step]=now()};
api.report=function(reason,detail){if(diag.reason||surface!=="app-login")return;diag.reason=reason;if(detail)diag.detail=String(detail).slice(0,160);diag.end=now();try{navigator.sendBeacon(${JSON.stringify(INTRO_TELEMETRY_PATH)},JSON.stringify(diag))}catch(e){}};
var early=function(){if(api.state==="pending")api.abort(true,"interaction")};
var arm=function(){api.mark("dcl");if(api.state==="pending")timer=setTimeout(function(){if(api.state==="pending")api.abort(false,"watchdog")},${INTRO_START_TIMEOUT_MS})};
api.release=function(){clearTimeout(timer);document.removeEventListener("DOMContentLoaded",arm);for(var i=0;i<evs.length;i++)w.removeEventListener(evs[i],early,true)};
api.markSeen=function(){if(surface==="app-login")try{w.localStorage.setItem(${JSON.stringify(STARTUP_INTRO_SEEN_KEY)},"1")}catch(e){}};
api.abort=function(remember,reason){if(api.state==="done")return;api.report(reason||"aborted");if(remember)api.markSeen();api.state="done";api.release();if(d.style&&d.style.backgroundColor)paint("rgb(244,243,236)");d.setAttribute("${INTRO_LEAVING_ATTRIBUTE}","");setTimeout(function(){d.removeAttribute("${INTRO_ATTRIBUTE}");d.removeAttribute("${INTRO_LEAVING_ATTRIBUTE}");if(d.style)paint("")},200)};
for(var i=0;i<evs.length;i++)w.addEventListener(evs[i],early,true);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",arm,{once:true});else arm();
}catch(e){d.removeAttribute("${INTRO_ATTRIBUTE}");if(d.style)paint("")}
})`

/** Static inline script (no user input) that decides whether the intro plays. */
export function buildIntroPrePaintScript(surface: IntroSurface): string {
    return `${SCRIPT}(${JSON.stringify(surface)});`
}

/** Runs in the root head, before a streamed login page or its body can paint. */
export function buildAppIntroPrePaintScript(): string {
    return `${SCRIPT}(location.pathname==="/login"?"app-login":null);`
}
