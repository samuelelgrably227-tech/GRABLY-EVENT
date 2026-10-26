// Base de données du site (Netlify Blobs) — partagée par les fonctions.
// Trois "tables" : invoices, tickets, attestations. Chaque enregistrement a un id
// et une date ; les gros fichiers (PDF des factures, PDF des attestations) sont
// rangés à part dans le magasin "files" pour garder les listes légères.
const { getStore, connectLambda } = require('@netlify/blobs');

// À appeler en tête de chaque fonction (format Lambda) pour brancher Blobs.
function init(event) {
  try { if (event && event.blobs) connectLambda(event); } catch (e) { /* ignoré */ }
}

const records = () => getStore({ name: 'records', consistency: 'strong' });
const files = () => getStore({ name: 'files', consistency: 'strong' });

const KINDS = ['invoices', 'tickets', 'attestations', 'events', 'clients'];

function newId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

async function saveRecord(kind, data, id) {
  if (!KINDS.includes(kind)) throw new Error('kind inconnu');
  const rid = id || newId();
  const rec = { ...data, id: rid, kind, savedAt: new Date().toISOString() };
  await records().setJSON(`${kind}/${rid}`, rec);
  return rec;
}

async function listRecords(kind) {
  if (!KINDS.includes(kind)) throw new Error('kind inconnu');
  const { blobs } = await records().list({ prefix: `${kind}/` });
  const out = [];
  for (const b of blobs) {
    const r = await records().get(b.key, { type: 'json' });
    if (r) out.push(r);
  }
  out.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
  return out;
}

async function getRecord(kind, id) {
  return records().get(`${kind}/${id}`, { type: 'json' });
}

async function saveFile(key, base64) {
  await files().set(key, base64);
}

async function getFile(key) {
  return files().get(key, { type: 'text' });
}

module.exports = { init, saveRecord, listRecords, getRecord, saveFile, getFile, KINDS };
