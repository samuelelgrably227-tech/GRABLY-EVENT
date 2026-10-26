// Envoi d'un e-mail libre avec pièces jointes (devis, documents…) depuis contact@grablyevent.com.
// Protégé par le code d'envoi (INVOICE_PIN), comme send-invoice.
//   POST { pin, to, subject, intro, lines:[...], filesBase64:[{ filename, content }], copy?:true }
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Méthode non autorisée' };
  const key = process.env.RESEND_API_KEY;
  const pinExpected = process.env.INVOICE_PIN;
  if (!key || !pinExpected) return { statusCode: 500, body: 'Configuration manquante (RESEND_API_KEY / INVOICE_PIN)' };

  let b;
  try { b = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: 'JSON invalide' }; }
  if (!b.pin || b.pin !== pinExpected) return { statusCode: 401, body: 'Code incorrect' };
  const to = Array.isArray(b.to) ? b.to : [b.to];
  if (!to.length || !to.every(t => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(t)))) return { statusCode: 400, body: 'Adresse e-mail invalide' };
  const files = Array.isArray(b.filesBase64) ? b.filesBase64 : [];
  const total = files.reduce((s, f) => s + String(f.content || '').length, 0);
  if (files.length > 15 || total > 30_000_000) return { statusCode: 400, body: 'Pièces jointes trop lourdes' };
  if (!b.subject || String(b.subject).length > 200) return { statusCode: 400, body: 'Objet manquant' };

  const esc = (t) => String(t || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const paras = [b.intro, ...(Array.isArray(b.lines) ? b.lines : [])].filter(Boolean)
    .map(t => `<p style="font-size:15px;line-height:1.6;margin:0 0 14px">${esc(t).replace(/\n/g, '<br>')}</p>`).join('');
  const html = `
  <div style="background:#ECEAE4;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;color:#16181D">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
      <div style="font-size:22px;font-weight:700;letter-spacing:.02em;margin-bottom:24px"><span style="color:#E3242B">G</span>E&nbsp; Grably Event</div>
      ${paras}
      <div style="border-top:1px solid #e4e2dc;padding-top:18px;margin-top:28px;font-size:13px;line-height:1.7;color:#4A4C53">
        Cordialement,<br><b style="color:#16181D">Samuel Elgrably – GRABLY EVENT</b><br>
        WhatsApp : +33 7 69 06 33 85<br>
        <a href="mailto:contact@grablyevent.com" style="color:#16181D">contact@grablyevent.com</a> · <a href="https://grablyevent.com" style="color:#16181D">grablyevent.com</a>
      </div>
    </div>
  </div>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Grably Event <contact@grablyevent.com>',
      to,
      bcc: b.copy === false ? [] : ['contact@grablyevent.com'],
      reply_to: 'contact@grablyevent.com',
      subject: String(b.subject),
      html,
      attachments: files.map(f => ({ filename: String(f.filename || 'document.pdf').slice(0, 120), content: String(f.content) })),
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    return { statusCode: 502, body: 'Resend : ' + t.slice(0, 300) };
  }
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
};
