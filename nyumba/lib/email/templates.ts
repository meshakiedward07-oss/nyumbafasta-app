const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nyumbafasta.co'

function emailBase(content: string, previewText = '') {
  return `<!DOCTYPE html>
<html lang="sw">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NyumbaFasta</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f4f4f5; color:#111827; }
    .wrapper { max-width:600px; margin:40px auto; background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 6px rgba(0,0,0,0.07); }
    .header { background:#000000; padding:28px 40px; text-align:center; }
    .logo-box { display:inline-block; text-decoration:none; }
    .logo-img { width:260px; max-width:100%; height:auto; display:block; margin:0 auto; }
    .body { padding:40px; }
    .greeting { font-size:22px; font-weight:700; color:#111827; margin-bottom:12px; }
    .text { font-size:15px; color:#4b5563; line-height:1.7; margin-bottom:16px; }
    .btn { display:inline-block; background:#1D9E75; color:white !important; padding:14px 32px; border-radius:10px; text-decoration:none; font-weight:600; font-size:15px; margin:24px 0; }
    .divider { border:none; border-top:1px solid #e5e7eb; margin:28px 0; }
    .info-box { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:16px 20px; margin:20px 0; }
    .info-box p { font-size:14px; color:#166534; line-height:1.8; }
    .footer { background:#f9fafb; padding:24px 40px; text-align:center; border-top:1px solid #e5e7eb; }
    .footer p { font-size:12px; color:#9ca3af; line-height:1.6; }
    .footer a { color:#1D9E75; text-decoration:none; }
  </style>
</head>
<body>
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden">${previewText}</div>` : ''}
  <div class="wrapper">
    <div class="header">
      <a href="${APP_URL}" class="logo-box">
        <img src="https://nyumbafasta.co/logo_nyumbafasta.png" alt="NyumbaFasta — Haraka &amp; Kwa Uhakika" class="logo-img" />
      </a>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p><a href="${APP_URL}">🌐 nyumbafasta.co</a> &nbsp;·&nbsp; <a href="https://wa.me/255665831694">💬 WhatsApp</a></p>
      <p style="margin-top:6px">© 2026 NyumbaFasta Tanzania. Haki zote zimehifadhiwa.</p>
      <p style="margin-top:4px">Umepata email hii kwa sababu umesajili akaunti kwenye <a href="${APP_URL}">nyumbafasta.co</a></p>
    </div>
  </div>
</body>
</html>`
}

export function verificationEmail(name: string, verificationUrl: string) {
  return {
    subject: '✅ Thibitisha Akaunti Yako — NyumbaFasta',
    html: emailBase(`
      <p class="greeting">Habari ${name}! 👋</p>
      <p class="text">Asante kwa kujisajili kwenye NyumbaFasta Tanzania! Tunafurahi kuwa nawe.</p>
      <p class="text">Bonyeza kitufe hapa chini kuthibitisha akaunti yako na kuanza kutumia huduma zetu:</p>
      <div style="text-align:center">
        <a href="${verificationUrl}" class="btn">✅ Thibitisha Akaunti Yangu</a>
      </div>
      <div class="info-box">
        <p>🔒 Kitufe hiki kitafanya kazi kwa masaa 24 tu.</p>
        <p>Ukishathibitisha — utaweza kuanza mara moja!</p>
      </div>
      <hr class="divider">
      <p class="text" style="font-size:13px;color:#9ca3af">Kama hukusajili akaunti hii — ignore email hii. Akaunti haitafunguliwa bila kuthibitisha.</p>
    `, 'Thibitisha akaunti yako ya NyumbaFasta'),
  }
}

export function welcomeEmail(name: string, role: string) {
  const isDalali = role === 'dalali'
  return {
    subject: `🎉 Karibu NyumbaFasta — ${name}!`,
    html: emailBase(`
      <p class="greeting">Hongera ${name}! 🎉</p>
      <p class="text">Akaunti yako imethibitishwa vizuri. Karibu kwenye familia ya NyumbaFasta Tanzania!</p>
      ${isDalali ? `
      <div class="info-box">
        <p>🏠 <strong>Kama Dalali unaweza:</strong></p>
        <p>✅ Kupost listings zako bure (hadi 2)</p>
        <p>✅ Kupokea wateja wa nyumba</p>
        <p>✅ Kutumia CRM dashboard</p>
        <p>✅ Trial ya wiki 2 ya Premium!</p>
      </div>
      <div style="text-align:center"><a href="${APP_URL}/dashboard" class="btn">🚀 Anza Kupost Listing →</a></div>
      ` : `
      <div class="info-box">
        <p>🔍 <strong>Sasa unaweza:</strong></p>
        <p>✅ Kutafuta nyumba Tanzania yote</p>
        <p>✅ Kufungua contact ya dalali</p>
        <p>✅ Kuhifadhi listings unazozipenda</p>
      </div>
      <div style="text-align:center"><a href="${APP_URL}" class="btn">🔍 Tafuta Nyumba Sasa →</a></div>
      `}
    `, `Karibu NyumbaFasta Tanzania!`),
  }
}

export function passwordResetEmail(name: string, resetUrl: string) {
  return {
    subject: '🔐 Reset Password — NyumbaFasta',
    html: emailBase(`
      <p class="greeting">Habari ${name}!</p>
      <p class="text">Tumepokea ombi la kubadilisha password ya akaunti yako.</p>
      <div style="text-align:center">
        <a href="${resetUrl}" class="btn">🔐 Badilisha Password →</a>
      </div>
      <div class="info-box">
        <p>⏰ Kitufe hiki kitafanya kazi kwa dakika 60 tu.</p>
      </div>
      <hr class="divider">
      <p class="text" style="font-size:13px;color:#9ca3af">Kama hukuomba kubadilisha password — ignore email hii. Password yako haijabadilika.</p>
    `, 'Badilisha password yako ya NyumbaFasta'),
  }
}

export function listingApprovedEmail(dalaliName: string, listingTitle: string, listingUrl: string) {
  return {
    subject: '🏠 Listing Yako Imeidhinishwa!',
    html: emailBase(`
      <p class="greeting">Hongera ${dalaliName}! 🎉</p>
      <p class="text">Listing yako imeidhinishwa na ipo live sasa! Wateja wanaweza kuiona mara moja.</p>
      <div class="info-box">
        <p>🏠 <strong>${listingTitle}</strong></p>
        <p>✅ Status: Live na inaonekana</p>
        <p>⏰ Itaisha baada ya siku 90</p>
      </div>
      <div style="text-align:center"><a href="${listingUrl}" class="btn">👁️ Angalia Listing Yako →</a></div>
      <p class="text" style="margin-top:20px">💡 <strong>Tip:</strong> Boost listing yako ili ionekane juu zaidi na kupata wateja haraka!</p>
    `, 'Listing yako ya NyumbaFasta imeidhinishwa!'),
  }
}

export function contactUnlockEmail(dalaliName: string, clientName: string, listingTitle: string) {
  return {
    subject: '🔓 Mteja Amefungua Contact Yako!',
    html: emailBase(`
      <p class="greeting">Habari ${dalaliName}! 🎉</p>
      <p class="text">Mteja amefungua contact yako kupitia listing yako! Wasiliana nao haraka kabla hawajaenda kwa dalali mwingine.</p>
      <div class="info-box">
        <p>👤 <strong>Mteja:</strong> ${clientName}</p>
        <p>🏠 <strong>Listing:</strong> ${listingTitle}</p>
        <p>💰 <strong>Malipo:</strong> Tsh 2,000 ✅</p>
      </div>
      <div style="text-align:center"><a href="${APP_URL}/dashboard" class="btn">📞 Angalia Mawasiliano →</a></div>
      <p class="text" style="font-size:13px;color:#9ca3af;margin-top:20px">💡 Jibu haraka — wateja wanaotafuta nyumba hawangoji muda mrefu!</p>
    `, 'Mteja amefungua contact yako!'),
  }
}
