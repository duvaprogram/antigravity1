// ==============================================================================
// Vercel Serverless Function: Cloudflare Stream Gateway
// Permite subir videos directamente a Cloudflare Stream evitando bloqueos de CORS
// ==============================================================================

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '250mb'
        }
    }
};

export default async function handler(req, res) {
    // Manejar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-account-id, x-api-token, x-max-duration, x-video-name');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const accountId = req.headers['x-account-id'] || req.query.accountId;
    const apiToken = req.headers['x-api-token'] || req.query.apiToken;

    if (!accountId || !apiToken) {
        return res.status(400).json({
            success: false,
            error: 'Faltan credenciales de Cloudflare (x-account-id o x-api-token).'
        });
    }

    try {
        // Modo 1: Generar Direct Creator Upload URL (Subida directa desde el navegador con CORS habilitado)
        if (req.method === 'GET' || req.query.action === 'get_upload_url') {
            const videoName = req.headers['x-video-name'] || req.query.name || 'video';
            const maxDuration = parseInt(req.headers['x-max-duration'] || req.query.maxDuration || '3600', 10);

            const cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    maxDurationSeconds: maxDuration,
                    meta: { name: videoName }
                })
            });

            const cfData = await cfRes.json();

            if (!cfData.success) {
                const errorDetail = cfData.errors && cfData.errors[0] ? cfData.errors[0].message : 'Error desconocido de Cloudflare';
                return res.status(cfRes.status).json({
                    success: false,
                    error: `Cloudflare Error: ${errorDetail}`,
                    details: cfData.errors
                });
            }

            return res.status(200).json({
                success: true,
                uploadURL: cfData.result.uploadURL,
                uid: cfData.result.uid,
                watchUrl: `https://iframe.videodelivery.net/${cfData.result.uid}`,
                manifestUrl: `https://videodelivery.net/${cfData.result.uid}/manifest/video.m3u8`,
                thumbnailUrl: `https://videodelivery.net/${cfData.result.uid}/thumbnails/thumbnail.jpg`,
                downloadUrl: `https://videodelivery.net/${cfData.result.uid}`
            });
        }

        // Modo 2: POST directo con cuerpo binario o datos
        if (req.method === 'POST') {
            // Reenviar a endpoint de direct_upload
            const videoName = req.headers['x-video-name'] || 'video';
            const cfInit = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    maxDurationSeconds: 3600,
                    meta: { name: videoName }
                })
            });

            const initData = await cfInit.json();
            if (!initData.success) {
                const errorDetail = initData.errors && initData.errors[0] ? initData.errors[0].message : 'Error de Cloudflare Stream';
                return res.status(400).json({
                    success: false,
                    error: errorDetail
                });
            }

            return res.status(200).json({
                success: true,
                uploadURL: initData.result.uploadURL,
                uid: initData.result.uid,
                watchUrl: `https://iframe.videodelivery.net/${initData.result.uid}`,
                manifestUrl: `https://videodelivery.net/${initData.result.uid}/manifest/video.m3u8`,
                thumbnailUrl: `https://videodelivery.net/${initData.result.uid}/thumbnails/thumbnail.jpg`
            });
        }

        return res.status(405).json({ success: false, error: 'Método no permitido' });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: 'Error de servidor al conectar con Cloudflare: ' + err.message
        });
    }
}
