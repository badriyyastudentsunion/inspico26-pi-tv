import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = parseInt(process.env.PORT || '3000', 10)
const HOST = '0.0.0.0'

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`)
  let pathname = decodeURIComponent(parsedUrl.pathname)

  if (pathname === '/') {
    pathname = '/index.html'
  }

  // Sanitize path to prevent directory traversal
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '')
  const filePath = path.join(__dirname, safePath)

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('404 Not Found')
      return
    }

    const ext = path.extname(filePath).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    })

    const stream = fs.createReadStream(filePath)
    stream.pipe(res)
  })
})

server.listen(PORT, HOST, () => {
  console.log('========================================================')
  console.log(`🎨 ART GALLERY - PI TV RESULTS DISPLAY`)
  console.log(`🌐 Local TV Display URL: http://localhost:${PORT}`)
  console.log(`📡 Network URL:         http://<PI_IP_ADDRESS>:${PORT}`)
  console.log(`⌨️  Ready for QR Scanning & Keyboard Controls`)
  console.log('========================================================')
})
