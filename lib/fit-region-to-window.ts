// Returns a ref callback that fits a scrolling region into the window, so a long list scrolls
// inside its card and the page itself never scrolls. The space above and below the region is
// measured because banners, wrapped headers and floating bars all change it. The result is
// published as a CSS variable (`property`) for the region's own height class to read.
// Phones keep the page scroll through a rule in app/mobile.css.
export function fitRegionToWindow(property: string) {
    return function fitToWindow(region: HTMLDivElement | null) {
        const main = region?.closest('main')
        if (!region || !main) return
        let page: HTMLElement = region
        while (page.parentElement && page.parentElement !== main) page = page.parentElement
        const fit = () => {
            const rect = region.getBoundingClientRect()
            const mainStyle = getComputedStyle(main)
            const below = page.getBoundingClientRect().bottom - rect.bottom + parseFloat(mainStyle.paddingBottom) + parseFloat(mainStyle.borderBottomWidth)
            region.style.setProperty(property, `${Math.floor(document.documentElement.clientHeight - rect.top - window.scrollY - below)}px`)
        }
        // Resizing the region resizes the page, so refit after the observer callback rather than inside it.
        let timer = 0
        const refit = () => { clearTimeout(timer); timer = window.setTimeout(fit) }
        const observer = new ResizeObserver(refit)
        observer.observe(page)
        window.addEventListener('resize', refit)
        fit()
        return () => { clearTimeout(timer); observer.disconnect(); window.removeEventListener('resize', refit) }
    }
}
