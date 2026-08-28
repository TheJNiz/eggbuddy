import { handleRedeemRequest } from './qrRedeem.js'

const PATHS = new Set(['/api/qr/redeem', '/eggbuddy/api/qr/redeem'])

export default function qrRedeemPlugin() {
  const mount = (server) => {
    server.middlewares.use((req, res, next) => {
      const url = req.url?.split('?')[0]
      if (!PATHS.has(url)) return next()
      handleRedeemRequest(req, res)
    })
  }

  return {
    name: 'eggbuddy-qr-redeem',
    configureServer: mount,
    configurePreviewServer: mount,
  }
}
