// Keep the native workspace picker lifecycle independent of the shared legacy picker.
export async function chooseElsewordsFile(extensions: string[], signal?: AbortSignal): Promise<{ name: string; data: Uint8Array } | null> {
    const files = await new Promise<File[]>((resolve, reject) => {
        const input = document.createElement('input')
        const previous = document.activeElement
        input.type = 'file'; input.accept = extensions.map(ext => `.${ext}`).join(',')
        input.style.display = 'none'
        let done = false
        const finish = (files: File[], error?: unknown) => {
            if (done) return
            done = true
            input.removeEventListener('change', changed); input.removeEventListener('cancel', cancelled)
            signal?.removeEventListener('abort', cancelled); input.remove()
            if (error) reject(error); else resolve(files)
            setTimeout(() => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }) }, 0)
        }
        const changed = () => finish(Array.from(input.files ?? []))
        const cancelled = () => finish([])
        input.addEventListener('change', changed); input.addEventListener('cancel', cancelled)
        signal?.addEventListener('abort', cancelled, { once: true })
        if (signal?.aborted) { cancelled(); return }
        document.body.appendChild(input)
        try { input.click() } catch (error) { finish([], error) }
    })
    const file = files[0]
    if (!file || signal?.aborted) return null
    if (!extensions.includes(file.name.split('.').pop()?.toLowerCase() ?? '')) throw new Error('Choose a file with one of the supported extensions.')
    if (file.size > 10 * 1024 * 1024) throw new Error('Choose a file smaller than 10 MiB.')
    const data = new Uint8Array(await file.arrayBuffer())
    return signal?.aborted ? null : { name: file.name, data }
}
