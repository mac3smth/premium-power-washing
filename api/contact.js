module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Read raw body from stream
  const raw = await new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk.toString(); });
    req.on('end', () => resolve(data));
  });

  const params = new URLSearchParams(raw);
  const name     = params.get('name')     || '';
  const email    = params.get('email')    || '';
  const phone    = params.get('phone')    || '';
  const postcode = params.get('postcode') || '';
  const service  = params.get('service')  || '';
  const message  = params.get('message')  || '';

  // WhatsApp-friendly phone (strip non-digits)
  const waPhone = phone.replace(/\D/g, '');

  const resendKey = process.env.RESEND_API_KEY;

  // ── Email to Nico ──────────────────────────────────────────────
  const ownerHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border-radius:10px;overflow:hidden">
  <div style="background:#0b1a2e;padding:24px 28px">
    <p style="margin:0;color:#4da8da;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase">Premium Power Washing</p>
    <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px">🔔 New Quote Request</h1>
  </div>
  <div style="background:#f4f7fb;padding:28px">
    <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
      <tr style="border-bottom:1px solid #eee"><td style="padding:12px 16px;color:#888;font-size:13px;width:90px">Name</td><td style="padding:12px 16px;font-weight:700;color:#111">${name}</td></tr>
      <tr style="border-bottom:1px solid #eee"><td style="padding:12px 16px;color:#888;font-size:13px">Phone</td><td style="padding:12px 16px"><a href="tel:${phone}" style="color:#1a8cff;font-weight:700;text-decoration:none">${phone}</a></td></tr>
      <tr style="border-bottom:1px solid #eee"><td style="padding:12px 16px;color:#888;font-size:13px">Email</td><td style="padding:12px 16px"><a href="mailto:${email}" style="color:#1a8cff;text-decoration:none">${email}</a></td></tr>
      <tr style="border-bottom:1px solid #eee"><td style="padding:12px 16px;color:#888;font-size:13px">Postcode</td><td style="padding:12px 16px">${postcode}</td></tr>
      <tr style="border-bottom:1px solid #eee"><td style="padding:12px 16px;color:#888;font-size:13px">Service</td><td style="padding:12px 16px;font-weight:600">${service}</td></tr>
      ${message ? `<tr><td style="padding:12px 16px;color:#888;font-size:13px;vertical-align:top">Message</td><td style="padding:12px 16px;color:#333">${message}</td></tr>` : ''}
    </table>
    <div style="margin-top:20px;display:flex;gap:12px">
      <a href="tel:${phone}" style="background:#1a8cff;color:#fff;padding:12px 22px;border-radius:7px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;margin-right:10px">📞 Call Back</a>
      <a href="https://wa.me/${waPhone}" style="background:#25D366;color:#fff;padding:12px 22px;border-radius:7px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">💬 WhatsApp</a>
    </div>
  </div>
</div>`;

  // ── Confirmation email to customer ─────────────────────────────
  const firstName = name.split(' ')[0];
  const customerHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border-radius:10px;overflow:hidden">
  <div style="background:#0b1a2e;padding:24px 28px">
    <p style="margin:0;color:#4da8da;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase">Premium Power Washing</p>
    <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px">Thanks, ${firstName}! We'll be in touch shortly.</h1>
  </div>
  <div style="background:#f4f7fb;padding:28px;color:#333;font-size:15px;line-height:1.6">
    <p>We've received your quote request for <strong>${service}</strong> and we'll get back to you within a few hours.</p>
    <p>If you need to reach us urgently, give us a call or WhatsApp:</p>
    <a href="tel:+447743646945" style="background:#1a8cff;color:#fff;padding:12px 22px;border-radius:7px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;margin-right:10px">📞 +44 7743 646945</a>
    <a href="https://wa.me/447743646945" style="background:#25D366;color:#fff;padding:12px 22px;border-radius:7px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;margin-top:10px">💬 WhatsApp Us</a>
    <p style="margin-top:20px;color:#555;font-size:14px">Or you can email us at <a href="mailto:premiumpowerwashinguk@gmail.com" style="color:#1a8cff;text-decoration:none">premiumpowerwashinguk@gmail.com</a></p>
    <p style="margin-top:24px;color:#888;font-size:13px">Premium Power Washing · Glasgow &amp; Surrounding Areas · <a href="https://www.premiumpowerwashing.co.uk" style="color:#1a8cff;text-decoration:none">premiumpowerwashing.co.uk</a></p>
  </div>
</div>`;

  try {
    const headers = {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    };

    await Promise.all([
      // Notify Nico
      fetch('https://api.resend.com/emails', {
        method: 'POST', headers,
        body: JSON.stringify({
          from: 'Premium Power Washing <quotes@premiumpowerwashing.co.uk>',
          to: ['premiumpowerwashinguk@gmail.com'],
          reply_to: email || undefined,
          subject: `🔔 New Quote — ${name} (${service})`,
          html: ownerHtml,
        }),
      }),
      // Confirm to customer
      email ? fetch('https://api.resend.com/emails', {
        method: 'POST', headers,
        body: JSON.stringify({
          from: 'Premium Power Washing <quotes@premiumpowerwashing.co.uk>',
          to: [email],
          subject: `We've received your quote request, ${firstName}!`,
          html: customerHtml,
        }),
      }) : Promise.resolve(),
    ]);
  } catch (err) {
    console.error('[Contact] Email error:', err.message);
  }

  // Redirect to thank you page
  res.writeHead(302, { Location: '/thanks.html' });
  res.end();
};
