// ==============================================================================
// Vercel Serverless Function: Cloudflare Images Gateway
// Dos usos desde el módulo Multimedia:
//   ?action=list   -> lista el catálogo de Cloudflare Images (evita CORS)
//   ?action=proxy  -> reenvía los bytes de una imagen para armar el ZIP
// ==============================================================================

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-account-id, x-api-token');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const action = req.query.action || 'list';

    // ------------------------------------------------------------------
    // Proxy de bytes: permite incluir en el ZIP imágenes cuyo servidor
    // de origen no envía cabeceras CORS al navegador.
    // ------------------------------------------------------------------
    if (action === 'proxy') {
        const target = req.query.url;
        if (!target) {
            return res.status(400).json({ success: false, error: 'Falta el parámetro url.' });
        }

        let parsed;
        try {
            parsed = new URL(target);
        } catch (e) {
            return res.status(400).json({ success: false, error: 'La url no es válida.' });
        }

        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            return res.status(400).json({ success: false, error: 'Solo se admiten enlaces http o https.' });
        }

        try {
            const upstream = await fetch(parsed.toString());
            if (!upstream.ok) {
                return res.status(upstream.status).json({
                    success: false,
                    error: `El origen respondió ${upstream.status}.`
                });
            }

            const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
            if (!contentType.startsWith('image/')) {
                return res.status(415).json({ success: false, error: 'El enlace no apunta a una imagen.' });
            }

            const buffer = Buffer.from(await upstream.arrayBuffer());
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.status(200).send(buffer);
        } catch (err) {
            return res.status(502).json({ success: false, error: 'No se pudo descargar la imagen: ' + err.message });
        }
    }

    // ------------------------------------------------------------------
    // Listado del catálogo de Cloudflare Images
    // ------------------------------------------------------------------
    const accountId = req.headers['x-account-id'] || req.query.accountId;
    const apiToken = req.headers['x-api-token'] || req.query.apiToken;

    if (!accountId || !apiToken) {
        return res.status(400).json({
            success: false,
            error: 'Faltan credenciales de Cloudflare (x-account-id o x-api-token).'
        });
    }

    try {
        const perPage = Math.min(parseInt(req.query.perPage || '200', 10) || 200, 1000);
        const page = Math.max(parseInt(req.query.page || '1', 10) || 1, 1);

        const cfRes = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1?per_page=${perPage}&page=${page}`,
            { headers: { 'Authorization': `Bearer ${apiToken}` } }
        );

        const cfData = await cfRes.json();

        if (!cfData.success) {
            const detalle = cfData.errors && cfData.errors[0] ? cfData.errors[0].message : 'Error desconocido de Cloudflare';
            return res.status(cfRes.status).json({
                success: false,
                error: `Cloudflare Error: ${detalle}`,
                details: cfData.errors
            });
        }

        return res.status(200).json(cfData);
    } catch (err) {
        return res.status(500).json({ success: false, error: 'Error consultando Cloudflare Images: ' + err.message });
    }
}
