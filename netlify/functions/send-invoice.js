// Envoi d'une facture par e-mail via Resend (https://resend.com)
// Variables d'environnement à définir dans Netlify : RESEND_API_KEY, INVOICE_PIN
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Méthode non autorisée' };
  const key = process.env.RESEND_API_KEY;
  const pinExpected = process.env.INVOICE_PIN;
  if (!key || !pinExpected) return { statusCode: 500, body: 'Configuration manquante (RESEND_API_KEY / INVOICE_PIN)' };

  let b;
  try { b = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: 'JSON invalide' }; }
  if (!b.pin || b.pin !== pinExpected) return { statusCode: 401, body: 'Code incorrect' };
  if (!b.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.to)) return { statusCode: 400, body: 'Adresse e-mail du client invalide' };
  if (!b.pdfBase64 || b.pdfBase64.length > 6_000_000) return { statusCode: 400, body: 'PDF manquant ou trop lourd' };

  const esc = (t) => String(t || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fr = (b.lang || 'fr') === 'fr';
  const subject = fr ? `Facture n° ${b.num} – Grably Event` : `Invoice #${b.num} – Grably Event`;
  const html = `
  <div style="background:#ECEAE4;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;color:#16181D">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
      <div style="font-size:22px;font-weight:700;letter-spacing:.02em;margin-bottom:24px"><span style="color:#E3242B">G</span>E&nbsp; Grably Event</div>
      <p style="font-size:15px;line-height:1.6;margin:0 0 14px">${fr ? 'Bonjour' : 'Hello'} ${esc(b.client)},</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 14px">${fr
        ? `Veuillez trouver ci-joint la facture <b>n° ${esc(b.num)}</b> d'un montant de <b>${esc(b.total)}</b>${b.due ? `, à régler avant le <b>${esc(b.due)}</b>` : ''}.`
        : `Please find attached invoice <b>#${esc(b.num)}</b> for <b>${esc(b.total)}</b>${b.due ? `, due by <b>${esc(b.due)}</b>` : ''}.`}</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 14px">${fr
        ? 'Les coordonnées bancaires figurent sur la facture. Pour toute question, vous pouvez répondre directement à ce mail ou me joindre sur WhatsApp.'
        : 'Bank details are on the invoice. For any question, simply reply to this email or reach me on WhatsApp.'}</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 28px">${fr ? 'Merci de votre confiance.' : 'Thank you for your trust.'}</p>
      <div style="border-top:1px solid #e4e2dc;padding-top:18px;font-size:13px;line-height:1.7;color:#4A4C53">
        ${fr ? 'Cordialement' : 'Best regards'},<br><b style="color:#16181D">GRABLY EVENT – ${fr ? 'Service facturation' : 'Billing'}</b><br>
        WhatsApp : +33 7 69 06 33 85<br>
        <a href="mailto:contact@grablyevent.com" style="color:#16181D">contact@grablyevent.com</a> · <a href="https://grablyevent.com" style="color:#16181D">grablyevent.com</a>
      </div>
    </div>
  </div>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Grably Event <facture@grablyevent.com>',
      to: [b.to],
      bcc: ['contact@grablyevent.com'],
      reply_to: 'contact@grablyevent.com',
      subject,
      html,
      attachments: [{ filename: b.filename || `Facture_${b.num}.pdf`, content: b.pdfBase64 }],
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    return { statusCode: 502, body: 'Resend : ' + t.slice(0, 300) };
  }
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
};
