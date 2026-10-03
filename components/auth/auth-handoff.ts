import {
    AUTH_TRANSITION_LEAVE_MS,
    AUTH_TRANSITION_ROUND_MS,
    prefersReducedMotion,
} from './auth-transition-timing'

/**
 * Sign-in and log out cross the auth boundary with a full-page navigation, and
 * the browser swaps the next page in as soon as it has something to paint,
 * which is usually before the animation has finished its round. So the page
 * being left hands its overlay to the next one: the next page rebuilds it
 * before its first paint (inside `AUTH_HANDOFF_HOST_TAG`, so hydration leaves
 * it alone), carries the loops on from the same frame, and takes it away when
 * the round ends. The request and the page load then run behind
 * the animation instead of after it.
 */
export const AUTH_HANDOFF_STORAGE_KEY = 'weavly:auth-handoff'

/**
 * React hydrates `<body>` and skips children whose tag it does not expect, but
 * it claims a `<div>` for its own and fails the whole hydration on a mismatch.
 * An unknown tag is always skipped, so the overlay lives inside one.
 */
export const AUTH_HANDOFF_HOST_TAG = 'weavly-handoff'

/** Not worth showing the overlay again for less than this. */
const MIN_REMAINING_MS = 120
/** The overlay is a few KB of SVG and copy; anything much bigger is not ours. */
const MAX_HTML_LENGTH = 24_000
const OVERLAY_OPENING = '<div class="auth-transition"'

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function sessionStorageOrNull(): KeyValueStorage | null {
    try {
        return typeof window === 'undefined' ? null : window.sessionStorage
    } catch {
        return null
    }
}

function openOverlay(): Element | null {
    return typeof document === 'undefined' ? null : document.querySelector('body > .auth-transition[data-state="open"]')
}

/**
 * Stores the overlay as it is on screen, with when its round began, for the
 * next page to carry on. `transitionStartedAt` is the `performance.now()`
 * reading from when the overlay opened. Does nothing under reduced motion
 * (the mark is still there) or when the round is already over.
 */
export function captureAuthHandoff(
    transitionStartedAt: number,
    {
        overlay = openOverlay(),
        now = performance.now(),
        epoch = Date.now(),
        reducedMotion = prefersReducedMotion(),
        storage = sessionStorageOrNull(),
    }: {
        overlay?: Element | null
        now?: number
        epoch?: number
        reducedMotion?: boolean
        storage?: KeyValueStorage | null
    } = {},
): boolean {
    if (!storage) return false
    try {
        const elapsed = now - transitionStartedAt
        const html = overlay?.outerHTML
        if (
            reducedMotion ||
            !html ||
            html.length > MAX_HTML_LENGTH ||
            AUTH_TRANSITION_ROUND_MS - elapsed < MIN_REMAINING_MS
        ) {
            storage.removeItem(AUTH_HANDOFF_STORAGE_KEY)
            return false
        }
        storage.setItem(AUTH_HANDOFF_STORAGE_KEY, JSON.stringify({ html, startedAt: Math.round(epoch - elapsed) }))
        return true
    } catch {
        // The next page then simply appears, as it always did.
        return false
    }
}

/**
 * Static inline script (no user input) for the top of `<body>`, so it runs
 * before the page's first paint. It rebuilds the stored overlay, puts every
 * looping animation on the frame the round has reached, and closes the overlay
 * when the round ends. It only accepts markup that looks like what
 * `captureAuthHandoff` wrote.
 */
export function buildAuthHandoffScript(): string {
    return `(function(){try{
var k=${JSON.stringify(AUTH_HANDOFF_STORAGE_KEY)},s=window.sessionStorage,raw=s.getItem(k);
if(!raw)return;
var m=JSON.parse(raw),elapsed=Date.now()-m.startedAt,left=${AUTH_TRANSITION_ROUND_MS}-elapsed,h=m.html;
if(typeof h!=="string"||typeof m.startedAt!=="number"||elapsed<0||left<${MIN_REMAINING_MS}||h.length>${MAX_HTML_LENGTH}||h.indexOf(${JSON.stringify(OVERLAY_OPENING)})!==0||/<script|\\son[a-z]+\\s*=/i.test(h)){s.removeItem(k);return}
var b=document.body;if(!b)return;
var t=document.createElement("template");t.innerHTML=h;var o=t.content.firstElementChild;if(!o)return;
o.setAttribute("data-resumed","");
var w=document.createElement(${JSON.stringify(AUTH_HANDOFF_HOST_TAG)});w.style.display="contents";w.appendChild(o);
b.insertBefore(w,b.firstChild);
var a=o.getAnimations?o.getAnimations({subtree:true}):[];
for(var i=0;i<a.length;i++){try{if(a[i].effect.getComputedTiming().iterations===Infinity)a[i].currentTime=elapsed;else a[i].finish()}catch(e){}}
setTimeout(function(){o.setAttribute("data-state","closed");setTimeout(function(){w.remove();s.removeItem(k)},${AUTH_TRANSITION_LEAVE_MS})},left);
}catch(e){}})();`
}
