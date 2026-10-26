// Lecture / écriture de la base (factures, envois de places, attestations).
// Protégé par le code d'envoi (INVOICE_PIN). Utilisé par factures.html,
// places.html et admin.html.
//   POST { pin, action:'list', kind }            -> liste des enregistrements
//   POST { pin, action:'get',  kind, id }        -> un enregistrement + son fichier
//   POST { pin, action:'save', kind, data, pdfBase64?, id? } -> enregistre
const db = require('./_db');

exports.handler = async (event) => {
  db.init(event);
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Méthode non autorisée' };
  const pinExpected = process.env.INVOICE_PIN;
  if (!pinExpected) return { statusCode: 500, body: 'Configuration manquante (INVOICE_PIN)' };

  let b;
  try { b = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: 'JSON invalide' }; }
  if (!b.pin || b.pin !== pinExpected) return { statusCode: 401, body: 'Code incorrect' };
  if (!db.KINDS.includes(b.kind)) return { statusCode: 400, body: 'Type inconnu' };

  const json = (obj) => ({ statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

  try {
    if (b.action === 'list') {
      return json({ items: await db.listRecords(b.kind) });
    }
    if (b.action === 'get') {
      const rec = await db.getRecord(b.kind, String(b.id || ''));
      if (!rec) return { statusCode: 404, body: 'Introuvable' };
      const file = rec.fileKey ? await db.getFile(rec.fileKey) : null;
      return json({ item: rec, pdfBase64: file });
    }
    if (b.action === 'save') {
      const data = (b.data && typeof b.data === 'object') ? b.data : {};
      const id = b.id ? String(b.id) : undefined;
      let fileKey;
      if (b.pdfBase64) {
        if (b.pdfBase64.length > 6_000_000) return { statusCode: 400, body: 'PDF trop lourd' };
        fileKey = `${b.kind}/${id || Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.pdf`;
        await db.saveFile(fileKey, b.pdfBase64);
      }
      const rec = await db.saveRecord(b.kind, { ...data, ...(fileKey ? { fileKey } : {}) }, id);
      return json({ ok: true, item: rec });
    }
    return { statusCode: 400, body: 'Action inconnue' };
  } catch (e) {
    return { statusCode: 500, body: 'Base : ' + String(e.message || e).slice(0, 200) };
  }
};
