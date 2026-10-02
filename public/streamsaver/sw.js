/* global self ReadableStream Response */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

const downloads = new Map()

self.onmessage = event => {
  if (event.data === 'ping') return

  const data = event.data
  const port = event.ports[0]
  const url = data.url || self.registration.scope + Math.random() + '/' + data.filename
  const stream = data.readableStream || (data.transferringReadable
    ? new Promise(resolve => {
        port.onmessage = message => {
          port.onmessage = null
          resolve(message.data.readableStream)
        }
      })
    : createStream(port))

  downloads.set(url, { data, port, stream })
  port.postMessage({ download: url })
}

function createStream(port) {
  return new ReadableStream({
    start(controller) {
      port.onmessage = ({ data }) => {
        if (data === 'end') return controller.close()
        if (data === 'abort') return controller.error('Aborted download')
        controller.enqueue(data)
      }
    },
    cancel(reason) {
      console.log('Download cancelled', reason)
      port.postMessage({ abort: true })
    }
  })
}

self.onfetch = event => {
  const url = event.request.url
  if (url.endsWith('/ping')) {
    event.respondWith(new Response('pong'))
    return
  }

  const download = downloads.get(url)
  if (!download) return

  downloads.delete(url)
  const headers = new Headers({
    'Content-Type': 'application/octet-stream; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'",
    'X-Content-Security-Policy': "default-src 'none'",
    'X-WebKit-CSP': "default-src 'none'",
    'X-XSS-Protection': '1; mode=block'
  })
  const requestedHeaders = new Headers(download.data.headers || {})
  for (const name of ['Content-Length', 'Content-Disposition']) {
    if (requestedHeaders.has(name)) headers.set(name, requestedHeaders.get(name))
  }

  event.respondWith(new Response(download.stream, { headers }))
  download.port.postMessage({ debug: 'Download started' })
}
