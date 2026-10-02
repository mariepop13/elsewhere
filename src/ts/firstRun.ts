/** Private source mode is explicit and restricted to loopback browser origins. */
export function isPrivateLocalMode(mode: unknown, hostname: string): boolean {
    return (
        mode === 'private-local' &&
        ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname)
    )
}

export const privateLocalMode = isPrivateLocalMode(
    import.meta.env.VITE_ELSEWHERE_USAGE_MODE,
    location.hostname,
)
// Temporary, explicitly authorized preview. Do not generalize this origin allowlist.
export const privatePreviewOrigin = 'https://bella-felix.taila3974e.ts.net:8443'
export function isPrivatePreviewMode(mode: unknown, configuredOrigin: unknown, origin: string): boolean {
    return mode === 'private-preview' && configuredOrigin === privatePreviewOrigin && origin === privatePreviewOrigin
}
export const privatePreviewMode = isPrivatePreviewMode(
    import.meta.env.VITE_ELSEWHERE_USAGE_MODE,
    import.meta.env.VITE_ELSEWHERE_PREVIEW_ORIGIN,
    location.origin,
)
export const privateSourceMode = privateLocalMode || privatePreviewMode
export const localNoticeKey = privatePreviewMode ? 'elsewhere.privatePreviewNotice.v1' : 'elsewhere.localNotice.v1'
