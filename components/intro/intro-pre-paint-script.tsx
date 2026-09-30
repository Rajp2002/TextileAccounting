import { buildIntroPrePaintScript } from '@/lib/intro/intro-policy'
import type { IntroSurface } from '@/lib/intro/weave-timeline'

/**
 * Must render before the page content so the decision is made before first
 * paint. The script is static (no user input), like the app-ready script in
 * the root layout.
 */
export function IntroPrePaintScript({ surface }: { surface: IntroSurface }) {
    return <script dangerouslySetInnerHTML={{ __html: buildIntroPrePaintScript(surface) }} />
}
