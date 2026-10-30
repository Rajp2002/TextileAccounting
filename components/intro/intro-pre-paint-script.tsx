import { APP_INTRO_PRE_PAINT_CSS, buildAppIntroPrePaintScript, buildIntroPrePaintScript } from '@/lib/intro/intro-policy'
import type { IntroSurface } from '@/lib/intro/weave-timeline'
import { DocumentLoadScript } from './document-load-script'

/**
 * Must render before the page content so the decision is made before first
 * paint. It reuses the head's decision on login, and decides here on landing.
 * Both scripts are static (no user input).
 */
export function IntroPrePaintScript({ surface }: { surface: IntroSurface }) {
    // Landing and login are also reached by client-side navigation, where an inline script never runs.
    return <DocumentLoadScript html={buildIntroPrePaintScript(surface)} />
}

/** Login startup styles and policy must be in the first document chunk. */
export function AppIntroPrePaintScript() {
    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: APP_INTRO_PRE_PAINT_CSS }} />
            <script dangerouslySetInnerHTML={{ __html: buildAppIntroPrePaintScript() }} />
        </>
    )
}
