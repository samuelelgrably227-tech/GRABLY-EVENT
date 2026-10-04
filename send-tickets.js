// Envoi des places par e-mail via Resend (https://resend.com)
// Variables d'environnement Netlify : RESEND_API_KEY, INVOICE_PIN (même code que pour les factures)
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Méthode non autorisée' };
  const key = process.env.RESEND_API_KEY;
  const pinExpected = process.env.INVOICE_PIN;
  if (!key || !pinExpected) return { statusCode: 500, body: 'Configuration manquante (RESEND_API_KEY / INVOICE_PIN)' };

  let b;
  try { b = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: 'JSON invalide' }; }
  if (!b.pin || b.pin !== pinExpected) return { statusCode: 401, body: 'Code incorrect' };
  if (!b.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.to)) return { statusCode: 400, body: 'Adresse e-mail du client invalide' };
  if (!['transfert', 'pdf', 'mobile'].includes(b.mode)) return { statusCode: 400, body: 'Mode inconnu' };

  const files = Array.isArray(b.files) ? b.files : [];
  const totalSize = files.reduce((s, f) => s + (f.content ? f.content.length : 0), 0);
  if (totalSize > 5_200_000) return { statusCode: 400, body: 'Pièces jointes trop lourdes (max ~4 Mo au total)' };
  for (const f of files) {
    if (!f.filename || !f.content || !/^[A-Za-z0-9+/=]+$/.test(f.content)) return { statusCode: 400, body: 'Pièce jointe invalide' };
  }

  const esc = (t) => String(t || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nl = (t) => esc(t).replace(/\n/g, '<br>');
  const link = (u) => { const s = String(u || '').trim(); const h = /^https?:\/\//i.test(s) ? s : 'https://' + s; return `<a href="${esc(h)}" style="color:#E3242B;font-weight:600;word-break:break-all">${esc(s)}</a>`; };
  const row = (k, v) => v ? `<tr><td style="padding:6px 0;color:#4A4C53;font-size:13px;width:140px;vertical-align:top">${k}</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#16181D">${v}</td></tr>` : '';

  const first = esc(b.prenom || b.client || '');
  const evName = esc(b.evenement || '');
  const evDate = esc(b.date || '');
  const evLieu = esc(b.lieu || '');
  const nb = b.nb ? `${esc(b.nb)} place${Number(b.nb) > 1 ? 's' : ''}` : '';
  const placement = esc(b.placement || '');

  const infoTable = `<table style="border-collapse:collapse;width:100%;margin:6px 0 18px">${row('Événement', evName)}${row('Date', evDate)}${row('Lieu', evLieu)}${row('Places', [nb, placement].filter(Boolean).join(' · '))}</table>`;

  let intro = '', body = '', subject = '';
  if (b.mode === 'transfert') {
    subject = `Vos places pour ${b.evenement || 'votre événement'} – transfert effectué`;
    intro = `Bonne nouvelle : vos places pour <b>${evName}</b> viennent de vous être transférées.`;
    body = `
      <table style="border-collapse:collapse;width:100%;margin:6px 0 18px">${row('Plateforme', esc(b.plateforme))}${row('Compte destinataire', esc(b.compte))}</table>
      <p style="font-size:15px;line-height:1.6;margin:0 0 14px">Connectez-vous à <b>${esc(b.plateforme) || 'la plateforme'}</b> avec ce compte : les billets apparaissent dans votre espace, généralement sous quelques minutes. Pensez à accepter le transfert si une notification vous le demande.</p>
      ${files.length ? `<p style="font-size:14px;line-height:1.6;margin:0 0 14px;color:#4A4C53">Vous trouverez en pièce jointe ${files.length > 1 ? 'les captures' : 'la capture'} confirmant le transfert.</p>` : ''}`;
  } else if (b.mode === 'pdf') {
    subject = `Vos places pour ${b.evenement || 'votre événement'}`;
    intro = `Voici vos places pour <b>${evName}</b>, en pièce jointe de ce mail.`;
    body = `
      <p style="font-size:15px;line-height:1.6;margin:0 0 14px">Téléchargez ${files.length > 1 ? 'les fichiers' : 'le fichier'} sur votre téléphone avant le jour J : ${files.length > 1 ? 'ils seront' : 'il sera'} à présenter à l'entrée (sur écran ou imprimé). Chaque billet ne peut être scanné qu'une seule fois.</p>`;
  } else {
    const links = String(b.liens || '').split('\n').map(s => s.trim()).filter(Boolean);
    subject = `Vos places pour ${b.evenement || 'votre événement'} – accès mobile`;
    intro = `Vos places pour <b>${evName}</b> sont disponibles sur mobile.`;
    body = `
      ${b.app ? `<p style="font-size:15px;line-height:1.6;margin:0 0 10px"><b>1.</b> Installez l'application <b>${esc(b.app)}</b>${b.appIos || b.appAndroid ? ' : ' + [b.appIos ? link(b.appIos) + ' (iPhone)' : '', b.appAndroid ? link(b.appAndroid) + ' (Android)' : ''].filter(Boolean).join(' · ') : ''}.</p>` : ''}
      ${links.length ? `<p style="font-size:15px;line-height:1.6;margin:0 0 10px"><b>${b.app ? '2' : '1'}.</b> Ouvrez ${links.length > 1 ? 'les liens' : 'le lien'} ci-dessous <b>depuis votre téléphone</b> :</p>
      <div style="margin:0 0 14px;padding:12px 16px;background:#F4F3EF;border-radius:10px;font-size:14px;line-height:1.8">${links.map(link).join('<br>')}</div>` : ''}
      ${b.instructions ? `<p style="font-size:15px;line-height:1.6;margin:0 0 14px">${nl(b.instructions)}</p>` : ''}
      <p style="font-size:14px;line-height:1.6;margin:0 0 14px;color:#4A4C53">Faites cette étape avant le jour J, avec une bonne connexion : les billets s'affichent ensuite dans l'application, même hors ligne.</p>`;
  }

  const html = `
  <div style="background:#ECEAE4;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;color:#16181D">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
      <div style="font-size:22px;font-weight:700;letter-spacing:.02em;margin-bottom:24px"><span style="color:#E3242B">G</span>E&nbsp; Grably Event</div>
      <p style="font-size:15px;line-height:1.6;margin:0 0 14px">Bonjour ${first},</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 14px">${intro}</p>
      ${infoTable}
      ${body}
      ${b.message ? `<p style="font-size:15px;line-height:1.6;margin:0 0 14px">${nl(b.message)}</p>` : ''}
      <p style="font-size:15px;line-height:1.6;margin:0 0 28px">Je reste joignable sur WhatsApp pour toute question. Profitez bien de l'événement !</p>
      <div style="border-top:1px solid #e4e2dc;padding-top:18px;font-size:13px;line-height:1.7;color:#4A4C53">
        Cordialement,<br><b style="color:#16181D">GRABLY EVENT</b><br>
        WhatsApp : <a href="https://wa.me/33769063385" style="color:#16181D">+33 7 69 06 33 85</a><br>
        <a href="mailto:contact@grablyevent.com" style="color:#16181D">contact@grablyevent.com</a> · <a href="https://grablyevent.com" style="color:#16181D">grablyevent.com</a>
      </div>
    </div>
  </div>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Grably Event <contact@grablyevent.com>',
      to: [b.to],
      bcc: ['contact@grablyevent.com'],
      reply_to: 'contact@grablyevent.com',
      subject,
      html,
      attachments: files.map(f => ({ filename: f.filename, content: f.content })),
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    return { statusCode: 502, body: 'Resend : ' + t.slice(0, 300) };
  }
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
};
