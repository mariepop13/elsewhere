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
export const localNoticeKey = 'elsewhere.localNotice.v1'
