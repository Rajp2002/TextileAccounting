/**
 * Imperative runtime for the woven brand intro (loaded lazily, only when the
 * pre-paint policy chose to play it). One requestAnimationFrame clock drives
 * the WebGL weave, the handoff clone of the real logo, and the page plane, all
 * from the pure timeline in lib/intro/weave-timeline.ts.
 *
 * Every exit path (natural end, skip, error, resize during the handoff, a
 * lost GPU context, unmount, pagehide) goes through `finish`, which restores
 * the page exactly: no overlay, no transforms, scroll unlocked.
 */
import { INTRO_ATTRIBUTE, INTRO_LEAVING_ATTRIBUTE, type IntroHandle, type IntroWindow } from '@/lib/intro/intro-policy'
import { containedImageRect, inkRect } from '@/lib/intro/target-geometry'
import { buildWeaveMask, LOGO_INK_BOX, LOGO_SOURCE, type WeaveMask } from '@/lib/intro/weave-mask'
import {
    composeIntro,
    HANDOFF_END,
    HANDOFF_START,
    introDuration,
    introStateAt,
    skipFrom,
    WEAVE_PASSES,
    workLightY,
    type IntroComposition,
    type IntroFrame,
    type IntroGeometry,
    type IntroSkip,
    type IntroSurface,
} from '@/lib/intro/weave-timeline'
import { WEAVE_FRAGMENT_SHADER, WEAVE_UNIFORMS, WEAVE_VERTEX_SHADER, type WeaveUniform } from './weave-shader'

type StartOptions = {
    surface: IntroSurface
    overlay: HTMLElement
    skipButton: HTMLButtonElement
    handle: IntroHandle
}

type IntroTestHooks = { renderAt: (t: number) => IntroFrame | null; skipAt: (t: number) => void; complete: () => void; duration: number }

const MAX_DPR = 2

/**
 * iOS standalone can leave a strip at the bottom of the screen that fixed elements (the stage)
 * cannot paint; only the root background reaches it. On the login surface the root background
 * follows the stage's own colour (dark cloth, then the beige ramp, then the page colour), so
 * the weave appears to run to the bottom edge and never flips to a different colour.
 */
const STRIP_DARK = [7, 7, 6]
const STRIP_BEIGE = [255, 248, 234]
const PAGE_BG = [244, 243, 236]
/** Paint the page root (html and body: iOS takes the strip colour from either) with no transition. */
function paintRoot(color: string) {
    document.documentElement.style.backgroundColor = color
    const body = document.body
    body.style.backgroundColor = color
    body.style.transition = color ? 'none' : ''
}

function stripColor(beige: number, fade: number, exposure: number): string {
    const warm = [40, 18, 0].map((c) => c * Math.sin(Math.PI * beige))
    const ch = STRIP_DARK.map((d, i) => {
        const cloth = (d * exposure + (STRIP_BEIGE[i] * 0.95 - d * exposure) * beige + warm[i]) * 1
        return Math.round(cloth + (PAGE_BG[i] - cloth) * fade)
    })
    return `rgb(${ch[0]}, ${ch[1]}, ${ch[2]})`
}
const SCROLL_KEYS = new Set([' ', 'Spacebar', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'])

function loadImage(src: string): Promise<HTMLImageElement> {
    const img = new Image()
    img.decoding = 'async'
    img.src = src
    return img.decode().then(() => img)
}

function readMask(img: HTMLImageElement): WeaveMask {
    const w = LOGO_INK_BOX.x1 - LOGO_INK_BOX.x0
    const h = LOGO_INK_BOX.y1 - LOGO_INK_BOX.y0
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('2d context unavailable')
    ctx.drawImage(img, LOGO_INK_BOX.x0, LOGO_INK_BOX.y0, w, h, 0, 0, w, h)
    const rgba = ctx.getImageData(0, 0, w, h).data
    const alpha = new Uint8Array(w * h)
    for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3]
    return buildWeaveMask(alpha, w, h, WEAVE_PASSES)
}

function findTarget(surface: IntroSurface): HTMLImageElement | null {
    return document.querySelector<HTMLImageElement>(`[data-weavly-intro-target="${surface}"] img`)
}

function measure(surface: IntroSurface, overlay: HTMLElement, target: HTMLImageElement): IntroGeometry | null {
    const vr = overlay.getBoundingClientRect()
    const parent = target.parentElement
    if (!parent || vr.width < 1 || vr.height < 1) return null
    const box = target.getBoundingClientRect() // includes any transform/scale on the <img>
    const drawn = containedImageRect(
        { x: box.left - vr.left, y: box.top - vr.top, w: box.width, h: box.height },
        LOGO_SOURCE,
        getComputedStyle(target).objectPosition,
    )
    const pr = parent.getBoundingClientRect() // the <img> fills its parent: its untransformed layout box
    let panel: IntroGeometry['panel'] = null
    let radius = 0
    if (surface === 'landing') {
        const panelEl = document.querySelector<HTMLElement>('[data-weavly-intro-panel]')
        if (!panelEl) return null
        const r = panelEl.getBoundingClientRect()
        panel = { l: r.left - vr.left, t: r.top - vr.top, r: r.right - vr.left, b: r.bottom - vr.top }
        radius = Number.parseFloat(getComputedStyle(panelEl).borderBottomLeftRadius) || 0
    }
    return {
        viewport: { w: vr.width, h: vr.height },
        ink: inkRect(drawn, LOGO_SOURCE, LOGO_INK_BOX),
        png: drawn,
        logoBox: { x: pr.left - vr.left, y: pr.top - vr.top, w: pr.width, h: pr.height },
        panel,
        radius,
    }
}

/** A clone of the real logo, rendered through the same path (object-fit, object-position, scale). */
function createClone(target: HTMLImageElement): { box: HTMLDivElement; img: HTMLImageElement } {
    const cs = getComputedStyle(target)
    const box = document.createElement('div')
    Object.assign(box.style, { position: 'absolute', left: '0px', top: '0px', opacity: '0', pointerEvents: 'none' })
    const img = document.createElement('img')
    img.alt = ''
    img.src = target.currentSrc || target.src
    // Layout-positioned, never transformed as a whole: browsers draw transformed images with a
    // cheaper filter, which would make the logo visibly thinner than the navbar's until the last frame.
    Object.assign(img.style, {
        position: 'absolute', inset: '0', display: 'block', width: '100%', height: '100%', maxWidth: 'none',
        objectFit: cs.objectFit, objectPosition: cs.objectPosition,
        transform: cs.transform, transformOrigin: cs.transformOrigin,
        scale: cs.scale, translate: cs.translate, rotate: cs.rotate,
    })
    box.appendChild(img)
    return { box, img }
}

type GLState = {
    gl: WebGL2RenderingContext
    uniforms: Record<WeaveUniform, WebGLUniformLocation | null>
}

function initGL(canvas: HTMLCanvasElement, mask: WeaveMask, logo: HTMLImageElement): GLState {
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false, powerPreference: 'high-performance' })
    if (!gl) throw new Error('webgl2 unavailable')
    const compile = (type: number, src: string) => {
        const s = gl.createShader(type)
        if (!s) throw new Error('shader alloc failed')
        gl.shaderSource(s, src)
        gl.compileShader(s)
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader compile failed')
        return s
    }
    const prog = gl.createProgram()
    if (!prog) throw new Error('program alloc failed')
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, WEAVE_VERTEX_SHADER))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, WEAVE_FRAGMENT_SHADER))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link failed')
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const uniforms = Object.fromEntries(WEAVE_UNIFORMS.map((n) => [n, gl.getUniformLocation(prog, n)])) as GLState['uniforms']

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    const maskTex = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, maskTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, mask.cols, mask.rows, 0, gl.RED, gl.UNSIGNED_BYTE, mask.data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    const logoTex = gl.createTexture()
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, logoTex)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, logo)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    gl.uniform1i(uniforms.uMask, 0)
    gl.uniform1i(uniforms.uLogo, 1)
    return { gl, uniforms }
}

export function startWeavingIntro({ surface, overlay, skipButton, handle }: StartOptions): () => void {
    const root = document.documentElement
    const testMode = process.env.NODE_ENV !== 'production' && new URLSearchParams(location.search).get('intro') === 'test'
    const cleanups: Array<() => void> = []
    let finished = false
    let raf = 0
    let canvas: HTMLCanvasElement | null = null
    let cloneBox: HTMLDivElement | null = null
    let glState: GLState | null = null
    let pagePlane: HTMLElement | null = null
    let pageRest = { x: 0, y: 0 }
    let geo: IntroGeometry | null = null
    let comp: IntroComposition | null = null
    let mask: WeaveMask | null = null
    let target: HTMLImageElement | null = null
    let t = 0
    let last = 0
    let paused = false
    let skip: IntroSkip | null = null
    let lastFrame: IntroFrame | null = null
    let frames = 0
    let slowFrames = 0
    let startedAt = 0

    const listen = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void, options?: AddEventListenerOptions) => {
        window.addEventListener(type, fn, options)
        cleanups.push(() => window.removeEventListener(type, fn, options))
    }

    const restorePage = () => {
        if (pagePlane) {
            pagePlane.style.transform = ''
            pagePlane.style.transformOrigin = ''
            pagePlane.style.willChange = ''
        }
    }

    const finish = (moveFocus: boolean) => {
        if (finished) return
        finished = true
        cancelAnimationFrame(raf)
        for (const fn of cleanups.splice(0)) fn()
        const focusWasInIntro = document.activeElement === skipButton || overlay.contains(document.activeElement)
        restorePage()
        glState?.gl.getExtension('WEBGL_lose_context')?.loseContext()
        canvas?.remove()
        cloneBox?.remove()
        overlay.style.opacity = ''
        overlay.style.background = ''
        skipButton.style.opacity = ''
        skipButton.removeAttribute('data-tone')
        paintRoot('')
        handle.release()
        handle.state = 'done'
        root.removeAttribute(INTRO_ATTRIBUTE)
        root.removeAttribute(INTRO_LEAVING_ATTRIBUTE)
        if (moveFocus && focusWasInIntro) {
            const next = surface === 'landing'
                ? target?.closest<HTMLElement>('a')
                : document.querySelector<HTMLElement>('form input')
            next?.focus({ preventScroll: true })
        }
        if (testMode) delete (window as IntroWindow & { __weavlyIntroTest?: IntroTestHooks }).__weavlyIntroTest
    }

    const bail = () => {
        // Nothing drawn yet: let the policy handle fade the black stage away.
        if (glState === null) {
            for (const fn of cleanups.splice(0)) fn()
            finished = true
            restorePage()
            canvas?.remove()
            cloneBox?.remove()
            handle.abort()
        } else {
            finish(true)
        }
    }

    /** The device cannot render the weave smoothly: fade straight to the page instead. */
    const degrade = () => {
        if (finished) return
        cancelAnimationFrame(raf)
        // Hand opacity back to the stylesheet so its leaving transition can run.
        overlay.style.opacity = ''
        skipButton.style.opacity = ''
        root.setAttribute(INTRO_LEAVING_ATTRIBUTE, '')
        window.setTimeout(() => finish(true), 200)
    }

    const doSkip = () => {
        if (finished || !lastFrame || skip || t >= HANDOFF_END) return
        skip = skipFrom(t, lastFrame)
    }

    const draw = (s: IntroFrame) => {
        if (!glState || !geo || !comp || !mask || !canvas || !cloneBox) return
        const { gl, uniforms: U } = glState
        const lb = geo.logoBox
        cloneBox.style.left = `${s.A.x + s.z * lb.x}px`
        cloneBox.style.top = `${s.A.y + s.z * lb.y}px`
        cloneBox.style.width = `${s.z * lb.w}px`
        cloneBox.style.height = `${s.z * lb.h}px`
        cloneBox.style.opacity = s.imgA.toFixed(3)
        overlay.style.opacity = (1 - s.fade).toFixed(3)
        if (surface === 'app-login') paintRoot(stripColor(s.beige, s.fade, s.exposure))
        skipButton.style.opacity = (1 - s.fade).toFixed(3)
        if (s.beige > 0.5) skipButton.setAttribute('data-tone', 'light')
        else skipButton.removeAttribute('data-tone')
        if (pagePlane) {
            const k = s.pageS
            if (k === 1) restorePage()
            else {
                // Scale about the camera's fixed point F (measured against the plane's rest position).
                pagePlane.style.willChange = 'transform'
                pagePlane.style.transformOrigin = `${comp.F.x - pageRest.x}px ${comp.F.y - pageRest.y}px`
                pagePlane.style.transform = `scale(${k})`
            }
        }
        const dpr = canvas.width / geo.viewport.w
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.uniform2f(U.uRes, canvas.width, canvas.height)
        gl.uniform1f(U.uDpr, dpr)
        gl.uniform2f(U.uCamA, s.A.x, s.A.y)
        gl.uniform1f(U.uZ, s.z)
        gl.uniform4f(U.uInk, geo.ink.x, geo.ink.y, geo.ink.w, geo.ink.h)
        gl.uniform2f(U.uGrid, mask.cols, mask.rows)
        gl.uniform4f(U.uPng, geo.png.x, geo.png.y, geo.png.w, geo.png.h)
        gl.uniform1f(U.uFell, s.fell)
        gl.uniform1f(U.uCarrierX, s.carrierX)
        gl.uniform1f(U.uInDir, s.inDir)
        gl.uniform1f(U.uCarrierA, s.carrierA)
        gl.uniform1f(U.uTrail, s.trail)
        gl.uniform1f(U.uFellY, workLightY(s, geo, mask))
        gl.uniform1f(U.uBeat, s.beat)
        gl.uniform1f(U.uReed, s.reed)
        gl.uniform1f(U.uReedA, 0.9 * s.tex)
        gl.uniform1f(U.uShed, s.shed * s.tex)
        gl.uniform1f(U.uTex, s.tex)
        gl.uniform1f(U.uBeige, s.beige)
        gl.uniform1f(U.uExposure, s.exposure)
        gl.uniform4f(U.uStage, s.stage[0], s.stage[1], s.stage[2], s.stage[3])
        gl.uniform1f(U.uRadius, s.radius)
        gl.uniform1f(U.uShadowZ, s.shadowZ)
        gl.uniform1f(U.uShadowA, s.shadowA)
        gl.uniform1f(U.uLogoA, s.logoA)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const frameAt = (time: number): IntroFrame | null => {
        if (!geo || !comp || !mask) return null
        const s = introStateAt(time, comp, geo, mask, skip)
        lastFrame = s
        draw(s)
        return s
    }

    const tick = (now: number) => {
        if (finished) return
        const realDt = last ? (now - last) / 1000 : 0
        last = now
        if (!startedAt) startedAt = now
        if (!paused) t += Math.min(0.05, realDt)
        // Weak GPU: judge the first real frames (after warm-up) and never let the intro crawl.
        frames++
        if (!paused && frames > 2 && frames <= 8 && realDt > 0.07) slowFrames++
        if (slowFrames >= 4 || (!paused && (now - startedAt) / 1000 > introDuration(surface) + 3)) { degrade(); return }
        const s = frameAt(t)
        if (!s || s.done) { finish(true); return }
        raf = requestAnimationFrame(tick)
    }

    const sizeCanvas = () => {
        if (!canvas || !geo) return
        const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1)
        canvas.width = Math.max(1, Math.round(geo.viewport.w * dpr))
        canvas.height = Math.max(1, Math.round(geo.viewport.h * dpr))
    }

    const measurePagePlane = () => {
        if (!pagePlane) return
        restorePage()
        const pr = pagePlane.getBoundingClientRect()
        pageRest = { x: pr.left, y: pr.top }
    }

    const onResize = () => {
        if (finished || !target || !mask) return
        // Re-framing during the pull-back would visibly jump: land immediately instead.
        if (skip || t >= HANDOFF_START) { finish(false); return }
        measurePagePlane()
        const next = measure(surface, overlay, target)
        if (!next) { finish(false); return }
        geo = next
        comp = composeIntro(surface, geo, mask)
        sizeCanvas()
    }

    const init = async () => {
        target = findTarget(surface)
        if (!target) throw new Error('intro target missing')
        // The start watchdog (or an early tap) may have removed the stage while we waited:
        // then stop quietly, never attaching listeners to a page that has moved on.
        const superseded = () => finished || handle.state !== 'pending'
        // Decode the logo, the page's own logo and the handoff clone together, not one after another.
        const clone = createClone(target)
        const [logo] = await Promise.all([
            loadImage(LOGO_SOURCE.src),
            target.decode().catch(() => undefined),
            clone.img.decode().catch(() => undefined),
        ])
        if (superseded()) { finished = true; return }
        mask = readMask(logo)
        geo = measure(surface, overlay, target)
        if (!geo) throw new Error('intro geometry unavailable')
        comp = composeIntro(surface, geo, mask)

        cloneBox = clone.box

        canvas = document.createElement('canvas')
        Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' })
        sizeCanvas()
        glState = initGL(canvas, mask, logo)
        canvas.addEventListener('webglcontextlost', () => finish(false))
        overlay.append(canvas, cloneBox)

        if (surface === 'landing') {
            pagePlane = document.querySelector<HTMLElement>('[data-weavly-intro-page]')
            measurePagePlane()
        }

        handle.state = 'running'
        handle.release()

        listen('keydown', (e) => {
            if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return
            if (SCROLL_KEYS.has(e.key) && document.activeElement !== skipButton) e.preventDefault()
            doSkip()
        }, { capture: true })
        listen('wheel', (e) => { e.preventDefault(); doSkip() }, { passive: false, capture: true })
        listen('touchmove', (e) => { e.preventDefault(); doSkip() }, { passive: false, capture: true })
        listen('pointerdown', () => doSkip(), { capture: true })
        listen('resize', onResize)
        listen('pagehide', () => finish(false))
        const onSkipClick = () => doSkip()
        skipButton.addEventListener('click', onSkipClick)
        cleanups.push(() => skipButton.removeEventListener('click', onSkipClick))
        const onVisibility = () => {
            paused = document.hidden
            last = 0
            if (!paused && startedAt) startedAt = performance.now() - t * 1000
        }
        document.addEventListener('visibilitychange', onVisibility)
        cleanups.push(() => document.removeEventListener('visibilitychange', onVisibility))
        const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
        const onMotion = (e: MediaQueryListEvent) => { if (e.matches) doSkip() }
        motion.addEventListener('change', onMotion)
        cleanups.push(() => motion.removeEventListener('change', onMotion))

        // The canvas now draws the stage itself (it must go transparent around the navbar).
        frameAt(0)
        overlay.style.background = 'transparent'

        if (testMode) {
            const hooks: IntroTestHooks = {
                renderAt: (time) => { t = time; return frameAt(time) },
                skipAt: (time) => { t = time; skip = null; frameAt(time); doSkip() },
                complete: () => finish(true),
                duration: introDuration(surface),
            }
            ;(window as IntroWindow & { __weavlyIntroTest?: IntroTestHooks }).__weavlyIntroTest = hooks
            return
        }
        raf = requestAnimationFrame(tick)
    }

    init().catch(() => bail())

    return () => {
        if (glState === null && !finished) bail()
        else finish(false)
    }
}
