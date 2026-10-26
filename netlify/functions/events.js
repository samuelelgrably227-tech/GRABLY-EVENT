// Événements à venir affichés sur le site vitrine (lecture publique, sans code).
// Ils sont gérés depuis admin.html (onglet Événements) et stockés dans la base.
// GET /.netlify/functions/events -> { items: [...] } (triés par ordre choisi, puis date)
const db = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Méthode non autorisée' };
  try {
    const rec = await db.getRecord('events', 'liste').catch(() => null);
    const today = new Date().toISOString().slice(0, 10);
    const items = ((rec && rec.items) || [])
      .filter(e => e && e.titre && (!e.date || e.date >= today) && e.visible !== false)
      .map(e => ({ titre: String(e.titre).slice(0, 120), sous: String(e.sous || '').slice(0, 160), date: String(e.date || '').slice(0, 10), dateTexte: String(e.dateTexte || '').slice(0, 80), lieu: String(e.lieu || '').slice(0, 120), tag: String(e.tag || '').slice(0, 40) }))
      .slice(0, 8);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
      body: JSON.stringify({ items }),
    };
  } catch (e) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [] }) };
  }
};
