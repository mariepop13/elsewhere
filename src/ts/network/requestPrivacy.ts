/** Logs retain routing metadata, never credentials or URL query values. */
export function redactRequestHeaders(headers: Record<string, string> = {}): Record<string, string> {
    return Object.fromEntries(Object.keys(headers).map(name => [name,
        ['content-type', 'accept'].includes(name.toLowerCase()) ? headers[name] : '[redacted]'
    ]))
}

export function redactRequestUrl(raw: string): string {
    try {
        const url = new URL(raw, location.origin)
        url.username = ''
        url.password = ''
        url.search = url.search ? '?[redacted]' : ''
        url.hash = ''
        return url.href
    } catch {
        return '[invalid URL]'
    }
}
