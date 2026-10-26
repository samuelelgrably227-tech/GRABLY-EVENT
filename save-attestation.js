// Enregistre une attestation de cession remplie par un vendeur (page publique,
// donc pas de code d'envoi). Garde-fous : taille limitée, champs filtrés,
// pas plus d'une attestation par seconde par adresse IP.
const db = require('./_db');

const lastByIp = new Map();

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Méthode non autorisée' };
  const ip = (event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || '').toString();
  const now = Date.now();
  if (ip && lastByIp.get(ip) && now - lastByIp.get(ip) < 1000) return { statusCode: 429, body: 'Trop rapide' };
  if (ip) lastByIp.set(ip, now);

  let b;
  try { b = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: 'JSON invalide' }; }
  if (!b.pdfBase64 || b.pdfBase64.length > 4_000_000) return { statusCode: 400, body: 'PDF manquant ou trop lourd' };
  if (!b.vendeur || String(b.vendeur).length > 120) return { statusCode: 400, body: 'Vendeur manquant' };

  const s = (v, n = 200) => String(v || '').slice(0, n);
  const data = {
    vendeur: s(b.vendeur, 120),
    email: s(b.email),
    tel: s(b.tel, 40),
    adresse: s(b.adresse, 300),
    evenement: s(b.evenement),
    billets: Array.isArray(b.billets) ? b.billets.slice(0, 20).map(x => ({ desc: s(x.desc), qte: Number(x.qte) || 0, prix: Number(x.prix) || 0 })) : [],
    total: Number(b.total) || 0,
    titulaire: s(b.titulaire, 120),
    iban: s(b.iban, 40),
    bic: s(b.bic, 20),
    date: s(b.date, 20),
    filename: s(b.filename, 120) || 'attestation.pdf',
  };
  try {
    const fileKey = `attestations/${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}.pdf`;
    await db.saveFile(fileKey, b.pdfBase64);
    const rec = await db.saveRecord('attestations', { ...data, fileKey });
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, id: rec.id }) };
  } catch (e) {
    return { statusCode: 500, body: 'Base : ' + String(e.message || e).slice(0, 200) };
  }
};
