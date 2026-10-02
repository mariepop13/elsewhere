import { resolveNativeCapabilities, parseOpenRouterCapabilities, type TokenSelection, type TokenCapabilities } from './tokenCapabilities';

// Public metadata only. No database, authorization headers, paid calls, or persistent save mutation.
export const tokenCapabilityCache = $state<{ entries: Record<string, TokenCapabilities> }>({ entries: {} });
const pending = new Map<string, Promise<TokenCapabilities>>();
const expires = new Map<string, number>();
let catalog: { data: any[]; expires: number } | undefined;
let catalogPending: Promise<any[]> | undefined;
export function capabilityKey(selection: TokenSelection): string { return JSON.stringify(selection); }
export function cachedTokenCapabilities(selection: TokenSelection): TokenCapabilities {
    return tokenCapabilityCache.entries[capabilityKey(selection)] ?? resolveNativeCapabilities(selection);
}
async function publicJson(url: string): Promise<any> {
    const response = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Public model metadata unavailable');
    return response.json();
}
export async function getPublicOpenRouterCatalog(): Promise<any[]> {
    if (catalog && catalog.expires > Date.now()) return catalog.data;
    if (!catalogPending) catalogPending = publicJson('https://openrouter.ai/api/v1/models').then(json => {
        const data = Array.isArray(json.data) ? json.data : [];
        catalog = { data, expires: Date.now() + 300000 };
        return data;
    }).finally(() => { catalogPending = undefined; });
    return catalogPending;
}
export async function loadTokenCapabilities(selection: TokenSelection): Promise<TokenCapabilities> {
    if (selection.provider !== 'openrouter') return resolveNativeCapabilities(selection);
    const key = capabilityKey(selection);
    if ((expires.get(key) ?? 0) > Date.now()) return cachedTokenCapabilities(selection);
    if (pending.has(key)) return pending.get(key)!;
    const task = (async () => {
        let cap = resolveNativeCapabilities(selection);
        try {
            const data = await getPublicOpenRouterCatalog();
            const raw = data.find(m => m.id === selection.modelId);
            if (raw) {
                const resolvedId = typeof raw.alias_target === 'string' ? raw.alias_target : raw.id;
                let endpoints: unknown;
                // Router selections have no single resolved model; leave capacities unknown.
                if (!resolvedId.startsWith('openrouter/') && /^[a-zA-Z0-9._~:-]+\/[a-zA-Z0-9._~:-]+$/.test(resolvedId)) {
                    try { endpoints = await publicJson(`https://openrouter.ai/api/v1/models/${resolvedId}/endpoints`); } catch { /* Keep catalog-only evidence. */ }
                }
                cap = parseOpenRouterCapabilities(selection, raw, endpoints);
            }
        } catch { /* Unknown limits remain editable; the provider remains authoritative. */ }
        tokenCapabilityCache.entries[key] = cap;
        expires.set(key, Date.now() + (cap.source ? 300000 : 30000));
        return cap;
    })().finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
}
