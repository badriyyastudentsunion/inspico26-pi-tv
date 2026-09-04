import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = parseInt(process.env.PORT || '3000', 10)
const HOST = '0.0.0.0'

const VIDEOS_DIR = path.join(__dirname, 'videos')
if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true })
}

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
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska'
}

// In-memory fallback TV state for 100% offline local venue operation
let localTvState = {
  blank_screen: false,
  video_mode: {
    active: false,
    url: '',
    filename: '',
    muted: false,
    loop: true
  },
  updated_at: Date.now()
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`)
  let pathname = decodeURIComponent(parsedUrl.pathname)

  // Enable CORS for all local network requests
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // --------------------------------------------------------------------------
  // API: Get List of Local Videos on Raspberry Pi
  // --------------------------------------------------------------------------
  if (pathname === '/api/videos' && req.method === 'GET') {
    try {
      const files = fs.readdirSync(VIDEOS_DIR)
      const list = files
        .filter(f => !f.startsWith('.'))
        .map(f => {
          const stat = fs.statSync(path.join(VIDEOS_DIR, f))
          const sizeMB = (stat.size / (1024 * 1024)).toFixed(1)
          return {
            filename: f,
            size: `${sizeMB} MB`,
            bytes: stat.size,
            url: `/videos/${encodeURIComponent(f)}`,
            created: stat.mtimeMs
          }
        })
        .sort((a, b) => b.created - a.created)

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(list))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  // --------------------------------------------------------------------------
  // API: Wireless Video Upload directly to Raspberry Pi
  // --------------------------------------------------------------------------
  if (pathname === '/api/upload-video' && req.method === 'POST') {
    const filename = parsedUrl.searchParams.get('filename') || `video_${Date.now()}.mp4`
    const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_')
    const destPath = path.join(VIDEOS_DIR, safeFilename)

    const fileStream = fs.createWriteStream(destPath)
    req.pipe(fileStream)

    fileStream.on('finish', () => {
      const stat = fs.statSync(destPath)
      const sizeMB = (stat.size / (1024 * 1024)).toFixed(1)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        success: true,
        filename: safeFilename,
        size: `${sizeMB} MB`,
        url: `/videos/${encodeURIComponent(safeFilename)}`
      }))
    })

    fileStream.on('error', (err) => {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message }))
    })
    return
  }

  // --------------------------------------------------------------------------
  // API: Delete Local Video
  // --------------------------------------------------------------------------
  if (pathname === '/api/delete-video' && (req.method === 'POST' || req.method === 'DELETE')) {
    const filename = parsedUrl.searchParams.get('filename')
    if (filename) {
      const targetPath = path.join(VIDEOS_DIR, path.basename(filename))
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath)
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: true }))
    return
  }

  // --------------------------------------------------------------------------
  // API: Local TV State Sync (For Offline Local WiFi Venue Operation)
  // --------------------------------------------------------------------------
  if (pathname === '/api/tv-state') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(localTvState))
      return
    } else if (req.method === 'POST') {
      let body = ''
      req.on('data', chunk => body += chunk)
      req.on('end', () => {
        try {
          const update = JSON.parse(body)
          localTvState = { ...localTvState, ...update, updated_at: Date.now() }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true, state: localTvState }))
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid JSON' }))
        }
      })
      return
    }
  }

  // --------------------------------------------------------------------------
  // Static File Serving with Hardware-Accelerated HTTP 206 Video Streaming
  // --------------------------------------------------------------------------
  if (pathname === '/') {
    pathname = '/index.html'
  }

  // Route /videos/... requests to the dedicated videos folder
  let filePath
  if (pathname.startsWith('/videos/')) {
    const subPath = pathname.replace(/^\/videos\//, '')
    filePath = path.join(VIDEOS_DIR, path.normalize(subPath).replace(/^(\.\.[\/\\])+/, ''))
  } else {
    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '')
    filePath = path.join(__dirname, safePath)
  }

  // Clean URL fallback: if no file extension, check for .html
  if (!path.extname(filePath) && fs.existsSync(filePath + '.html')) {
    filePath = filePath + '.html'
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('404 Not Found')
      return
    }

    const ext = path.extname(filePath).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    // Stream Video with Partial Content Range Requests for 60 FPS Seek & Buffer
    if (ext === '.mp4' || ext === '.webm' || ext === '.mov' || ext === '.mkv') {
      const range = req.headers.range
      const fileSize = stats.size

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-")
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
        const chunksize = (end - start) + 1
        const file = fs.createReadStream(filePath, { start, end })

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType,
          'Cache-Control': 'no-cache'
        })
        file.pipe(res)
        return
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Accept-Ranges': 'bytes',
          'Content-Type': contentType,
          'Cache-Control': 'no-cache'
        })
        fs.createReadStream(filePath).pipe(res)
        return
      }
    }

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
