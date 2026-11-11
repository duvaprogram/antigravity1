// ==============================================================================
// Migración de Cloudflare Images: cuenta vieja -> cuenta nueva (mismo ID de imagen)
//
// Se conserva el ID viejo dentro del nuevo (con prefijo "mig/"), así el link cambia
// siempre igual y basta UN buscar y reemplazar:
//   imagedelivery.net/<HASH_VIEJO>/<ID>/<variante>
//     ->  imagedelivery.net/<HASH_NUEVO>/mig/<ID>/<variante>
//
// Variables de entorno (tú las pones en tu terminal; el script no las guarda):
//   CF_OLD_ACCOUNT_ID, CF_OLD_TOKEN   cuenta vieja  (token con Cloudflare Images: Read)
//   CF_NEW_ACCOUNT_ID, CF_NEW_TOKEN   cuenta nueva  (token con Cloudflare Images: Edit)
//
// Uso:
//   node tools/migrar-cloudflare-images.mjs               -> SIMULACRO: no escribe nada
//   node tools/migrar-cloudflare-images.mjs --limite 1    -> migra solo 1 imagen (prueba)
//   node tools/migrar-cloudflare-images.mjs --todo        -> migra todas
//
// Se puede repetir sin miedo: lo ya migrado se salta (no se duplica nada).
// Salida en ./migracion-out/ : mapa.csv (id, link viejo, link nuevo) y errores.csv
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.cloudflare.com/client/v4';
const OUT_DIR = path.resolve('migracion-out');
const CONCURRENCIA = 5;
// Cloudflare no admite como ID personalizado un UUID "puro" (error 5411), y los IDs
// viejos lo son. Con un prefijo de subruta el ID viejo se conserva completo:
//   <ID viejo>  ->  mig/<ID viejo>
const PREFIJO = process.env.CF_ID_PREFIX || 'mig/';

const args = process.argv.slice(2);
const MIGRAR_TODO = args.includes('--todo');
const iLimite = args.indexOf('--limite');
const LIMITE = iLimite >= 0 ? parseInt(args[iLimite + 1], 10) : null;
const SIMULACRO = !MIGRAR_TODO && !(LIMITE > 0);

const env = {
    oldId: process.env.CF_OLD_ACCOUNT_ID,
    oldTok: process.env.CF_OLD_TOKEN,
    newId: process.env.CF_NEW_ACCOUNT_ID,
    newTok: process.env.CF_NEW_TOKEN
};
const faltan = Object.entries({
    CF_OLD_ACCOUNT_ID: env.oldId, CF_OLD_TOKEN: env.oldTok,
    CF_NEW_ACCOUNT_ID: env.newId, CF_NEW_TOKEN: env.newTok
}).filter(([, v]) => !v).map(([k]) => k);
if (faltan.length) {
    console.error('Faltan variables de entorno: ' + faltan.join(', '));
    process.exit(1);
}
if (env.oldId === env.newId) {
    console.error('La cuenta vieja y la nueva son la misma (CF_OLD_ACCOUNT_ID = CF_NEW_ACCOUNT_ID). Revisa.');
    process.exit(1);
}

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

// Llamada a la API con reintentos ante 429 / 5xx.
async function cf(token, ruta, opciones = {}, intentos = 5) {
    for (let i = 1; i <= intentos; i++) {
        const res = await fetch(API + ruta, {
            ...opciones,
            headers: { Authorization: `Bearer ${token}`, ...(opciones.headers || {}) }
        });
        if ((res.status === 429 || res.status >= 500) && i < intentos) {
            await dormir(1000 * i * i);
            continue;
        }
        return res;
    }
}

async function cfJson(token, ruta, opciones) {
    const res = await cf(token, ruta, opciones);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok && data.success !== false, data };
}

const hashDeUrl = (u) => (String(u || '').match(/imagedelivery\.net\/([^/]+)\//) || [])[1] || null;
const csv = (v) => {
    const t = v === null || v === undefined ? '' : String(v);
    return /[",\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
};

// ------------------------------------------------------------------------------
async function listarImagenesViejas() {
    const todas = [];
    let token = null;
    do {
        const q = new URLSearchParams({ per_page: '1000' });
        if (token) q.set('continuation_token', token);
        const r = await cfJson(env.oldTok, `/accounts/${env.oldId}/images/v2?${q}`);
        if (!r.ok) throw new Error('No se pudo listar la cuenta vieja: ' + JSON.stringify(r.data.errors || r.status));
        todas.push(...(r.data.result.images || []));
        token = r.data.result.continuation_token || null;
        process.stdout.write(`\r  Leídas ${todas.length} imágenes...`);
    } while (token);
    process.stdout.write('\n');
    return todas;
}

async function variantes(token, accountId) {
    const r = await cfJson(token, `/accounts/${accountId}/images/v1/variants`);
    if (!r.ok) throw new Error('No se pudieron leer las variantes: ' + JSON.stringify(r.data.errors || r.status));
    // Cloudflare las devuelve como objeto { nombre: {id, options, ...} }; las paso a lista.
    const v = r.data.result.variants || {};
    return (Array.isArray(v) ? v : Object.values(v)).filter(x => x && x.id);
}

// Crea en la cuenta nueva las variantes que existan en la vieja y falten allá.
async function sincronizarVariantes() {
    const viejas = await variantes(env.oldTok, env.oldId);
    const nuevas = await variantes(env.newTok, env.newId);
    const nombresNuevas = new Set(nuevas.map(v => v.id));
    const faltantes = viejas.filter(v => !nombresNuevas.has(v.id));

    console.log(`  Variantes en la vieja: ${viejas.map(v => v.id).join(', ') || '(ninguna)'}`);
    if (!faltantes.length) {
        console.log('  La cuenta nueva ya tiene todas las variantes.');
        return;
    }
    console.log(`  Faltan en la nueva: ${faltantes.map(v => v.id).join(', ')}`);
    if (SIMULACRO) return;

    for (const v of faltantes) {
        const r = await cfJson(env.newTok, `/accounts/${env.newId}/images/v1/variants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: v.id, options: v.options, neverRequireSignedURLs: v.neverRequireSignedURLs })
        });
        console.log(r.ok ? `  + Variante "${v.id}" creada` : `  ! No se pudo crear "${v.id}": ${JSON.stringify(r.data.errors || r.status)}`);
    }
}

// Sube una imagen a la cuenta nueva con el MISMO id.
async function migrarUna(img) {
    const meta = img.meta && Object.keys(img.meta).length ? JSON.stringify(img.meta) : null;
    const urlOrigen = (img.variants && img.variants[0]) || null;

    const construir = (extra) => {
        const fd = new FormData();
        fd.append('id', PREFIJO + img.id);
        if (meta) fd.append('metadata', meta);
        fd.append('requireSignedURLs', 'false');
        extra(fd);
        return fd;
    };

    // 1) Cloudflare descarga directo desde el link viejo (rápido, no pasa por tu PC).
    let r = null;
    if (urlOrigen) {
        r = await cfJson(env.newTok, `/accounts/${env.newId}/images/v1`, {
            method: 'POST',
            body: construir(fd => fd.append('url', urlOrigen))
        });
    }

    // 2) Respaldo: bajar los bytes con el token viejo y subirlos como archivo.
    if (!r || (!r.ok && !yaExiste(r))) {
        const blobRes = await cf(env.oldTok, `/accounts/${env.oldId}/images/v1/${encodeURIComponent(img.id)}/blob`);
        if (!blobRes.ok) {
            return { estado: 'error', detalle: `No se pudo descargar el original (HTTP ${blobRes.status})` };
        }
        const bytes = await blobRes.arrayBuffer();
        const nombre = img.filename || img.id;
        r = await cfJson(env.newTok, `/accounts/${env.newId}/images/v1`, {
            method: 'POST',
            body: construir(fd => fd.append('file', new Blob([bytes]), nombre))
        });
    }

    if (yaExiste(r)) return { estado: 'saltada', detalle: 'ya existía en la cuenta nueva' };
    if (!r.ok) return { estado: 'error', detalle: JSON.stringify(r.data.errors || r.status) };
    return { estado: 'migrada', variants: r.data.result && r.data.result.variants };
}

// Cloudflare responde error 5409 cuando el ID ya existe.
function yaExiste(r) {
    if (!r || !r.data || !Array.isArray(r.data.errors)) return false;
    return r.data.errors.some(e => e.code === 5409 || /already exists/i.test(e.message || ''));
}

// ------------------------------------------------------------------------------
async function main() {
    console.log(SIMULACRO
        ? '== SIMULACRO: no se escribe nada en la cuenta nueva =='
        : `== MIGRANDO ${LIMITE > 0 ? LIMITE + ' imagen(es)' : 'TODAS las imágenes'} ==`);

    console.log('\n1) Leyendo la cuenta vieja...');
    const viejas = await listarImagenesViejas();
    if (!viejas.length) { console.log('No hay imágenes en la cuenta vieja.'); return; }

    const hashViejo = hashDeUrl(viejas.find(i => i.variants && i.variants[0])?.variants[0]);
    console.log(`  Total: ${viejas.length} imágenes. Hash de la cuenta vieja: ${hashViejo || '(no detectado)'}`);

    const firmadas = viejas.filter(i => i.requireSignedURLs).length;
    if (firmadas) {
        console.log(`  AVISO: ${firmadas} imágenes usan links firmados. Con ID propio Cloudflare no admite links firmados, se migrarán como públicas.`);
    }

    console.log('\n2) Variantes...');
    await sincronizarVariantes();

    if (SIMULACRO) {
        console.log('\nSimulacro terminado. Para probar con una imagen:  node tools/migrar-cloudflare-images.mjs --limite 1');
        return;
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const archivoMapa = path.join(OUT_DIR, 'mapa.csv');
    const archivoErrores = path.join(OUT_DIR, 'errores.csv');
    if (!fs.existsSync(archivoMapa)) fs.writeFileSync(archivoMapa, '﻿id,archivo,categoria,link_viejo,link_nuevo\r\n');
    if (!fs.existsSync(archivoErrores)) fs.writeFileSync(archivoErrores, '﻿id,archivo,detalle\r\n');

    const lote = LIMITE > 0 ? viejas.slice(0, LIMITE) : viejas;
    console.log(`\n3) Migrando ${lote.length} imágenes (${CONCURRENCIA} a la vez)...`);

    const cuentas = { migrada: 0, saltada: 0, error: 0 };
    let hashNuevo = null;
    let siguiente = 0;
    const t0 = Date.now();

    async function trabajador() {
        while (siguiente < lote.length) {
            const img = lote[siguiente++];
            let res;
            try { res = await migrarUna(img); }
            catch (e) { res = { estado: 'error', detalle: e.message }; }

            cuentas[res.estado]++;
            const viejoLink = (img.variants && img.variants[0]) || '';
            const cat = (img.meta && (img.meta.category || img.meta.catalogo)) || '';

            if (res.estado === 'migrada') {
                const nuevoLink = (res.variants && res.variants[0]) || '';
                hashNuevo = hashNuevo || hashDeUrl(nuevoLink);
                fs.appendFileSync(archivoMapa, [img.id, img.filename || '', cat, viejoLink, nuevoLink].map(csv).join(',') + '\r\n');
            } else if (res.estado === 'error') {
                fs.appendFileSync(archivoErrores, [img.id, img.filename || '', res.detalle].map(csv).join(',') + '\r\n');
            }

            const hechas = cuentas.migrada + cuentas.saltada + cuentas.error;
            process.stdout.write(`\r  ${hechas}/${lote.length}  migradas: ${cuentas.migrada}  saltadas: ${cuentas.saltada}  errores: ${cuentas.error}   `);
        }
    }
    await Promise.all(Array.from({ length: CONCURRENCIA }, trabajador));

    const seg = Math.round((Date.now() - t0) / 1000);
    console.log(`\n\nListo en ${seg}s.  Migradas: ${cuentas.migrada}  Saltadas: ${cuentas.saltada}  Errores: ${cuentas.error}`);
    console.log(`Archivos en ${OUT_DIR}`);

    if (hashViejo && hashNuevo) {
        console.log('\nBuscar y reemplazar en tus otros sistemas:');
        console.log(`  imagedelivery.net/${hashViejo}/   ->   imagedelivery.net/${hashNuevo}/${PREFIJO}`);
    } else if (hashViejo) {
        console.log(`\nEl hash nuevo sale en link_nuevo de mapa.csv (o en Cloudflare > Images > Overview).`);
    }
    if (cuentas.error) console.log('Revisa errores.csv y vuelve a correr el mismo comando: solo reintenta lo que falló.');
}

main().catch(e => { console.error('\nError fatal:', e.message); process.exit(1); });
