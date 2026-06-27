import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

const serveLegalPages = () => {
  const legalPages = new Map([
    ['/privacy/', resolve('public/privacy/index.html')],
    ['/terms/', resolve('public/terms/index.html')],
  ])

  return (req, res, next) => {
    const pathname = req.url?.split('?')[0]
    const filePath = legalPages.get(pathname)

    if (!filePath) {
      next()
      return
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(readFileSync(filePath, 'utf8'))
  }
}

const legalPagesPlugin = () => ({
  name: 'ttp-legal-pages',
  configureServer(server) {
    server.middlewares.use(serveLegalPages())
  },
  configurePreviewServer(server) {
    server.middlewares.use(serveLegalPages())
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [legalPagesPlugin(), react()],
  build: { sourcemap: true },
})
