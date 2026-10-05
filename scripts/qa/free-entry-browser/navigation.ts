export const useSearchParams = () => new URLSearchParams(location.search)
export const useRouter = () => ({ refresh() {}, replace(href: string) { location.assign(href) }, push(href: string) { location.assign(href) } })
