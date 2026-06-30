const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nyumbafasta.co'

// All styles are fully inline — <style> blocks are stripped by Gmail and Outlook.
function emailBase(content: string, previewText = '') {
  return `<!DOCTYPE html>
<html lang="sw">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NyumbaFasta</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ''}

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:40px 0">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" border="0"
          style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);max-width:560px;width:100%">

          <!-- ── Header ──────────────────────────────────────── -->
          <tr>
            <td align="center" style="background:#1D9E75;padding:28px 40px">
              <a href="${APP_URL}" style="text-decoration:none;display:block">
                <img
                  src="https://nyumbafasta.co/logo-white.svg"
                  alt="NyumbaFasta"
                  width="200"
                  style="display:block;margin:0 auto;max-width:200px;height:auto"
                />
              </a>
            </td>
          </tr>

          <!-- ── Body ───────────────────────────────────────── -->
          <tr>
            <td style="padding:40px 40px 32px">
              ${content}
            </td>
          </tr>

          <!-- ── Footer ─────────────────────────────────────── -->
          <tr>
            <td style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center">
              <p style="font-size:12px;color:#9ca3af;line-height:1.6;margin:0">
                <a href="${APP_URL}" style="color:#1D9E75;text-decoration:none">🌐 nyumbafasta.co</a>
                &nbsp;·&nbsp;
                <a href="https://wa.me/255665831694" style="color:#1D9E75;text-decoration:none">💬 WhatsApp</a>
              </p>
              <p style="font-size:12px;color:#9ca3af;line-height:1.6;margin:6px 0 0">
                © 2026 NyumbaFasta Tanzania. Haki zote zimehifadhiwa.
              </p>
              <p style="font-size:11px;color:#d1d5db;margin:4px 0 0">
                Umepata email hii kwa sababu umesajili akaunti kwenye
                <a href="${APP_URL}" style="color:#9ca3af;text-decoration:none">nyumbafasta.co</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`
}

// Reusable inline-style snippets
const styles = {
  greeting:  'font-size:22px;font-weight:700;color:#111827;margin:0 0 12px;display:block',
  text:      'font-size:15px;color:#4b5563;line-height:1.7;margin:0 0 16px;display:block',
  textSmall: 'font-size:13px;color:#9ca3af;line-height:1.6;margin:0;display:block',
  btn:       'display:inline-block;background:#1D9E75;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;margin:24px 0',
  infoBox:   'background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;margin:20px 0',
  infoText:  'font-size:14px;color:#166534;line-height:1.8;margin:0',
  divider:   'border:none;border-top:1px solid #e5e7eb;margin:28px 0',
  linkSmall: 'color:#1D9E75;word-break:break-all;font-size:12px',
}

// ── Verification email ─────────────────────────────────────────────────────

export function verificationEmail(name: string, verificationUrl: string) {
  return {
    subject: '✅ Thibitisha Akaunti Yako — NyumbaFasta',
    html: emailBase(`
      <span style="${styles.greeting}">Habari ${name}! 👋</span>
      <span style="${styles.text}">Asante kwa kujisajili kwenye NyumbaFasta Tanzania! Bonyeza kitufe hapa chini kuthibitisha akaunti yako na kuanza kutumia huduma zetu.</span>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center">
            <a href="${verificationUrl}" style="${styles.btn}">✅ Thibitisha Akaunti Yangu</a>
          </td>
        </tr>
      </table>

      <div style="${styles.infoBox}">
        <p style="${styles.infoText}">🔒 Kitufe hiki kitafanya kazi kwa masaa 24 tu.</p>
        <p style="${styles.infoText}">Ukishathibitisha — utaweza kuanza mara moja!</p>
      </div>

      <hr style="${styles.divider}">
      <span style="${styles.textSmall}">Kama hukusajili akaunti hii, ignore email hii. Akaunti haitafunguliwa bila kuthibitisha.</span>
      <span style="${styles.textSmall};margin-top:12px">Kiungo hakifanyi kazi? Nakili na ubandike:</span>
      <a href="${verificationUrl}" style="${styles.linkSmall}">${verificationUrl}</a>
    `, 'Thibitisha akaunti yako ya NyumbaFasta'),
  }
}

// ── Welcome email (sent after email confirmed) ─────────────────────────────

export function welcomeEmail(name: string, role: string) {
  const isDalali = role === 'dalali'
  return {
    subject: `🎉 Karibu NyumbaFasta — ${name}!`,
    html: emailBase(`
      <span style="${styles.greeting}">Hongera ${name}! 🎉</span>
      <span style="${styles.text}">Akaunti yako imethibitishwa vizuri. Karibu kwenye familia ya NyumbaFasta Tanzania!</span>

      ${isDalali ? `
      <div style="${styles.infoBox}">
        <p style="${styles.infoText}">🏠 <strong>Kama Dalali unaweza:</strong></p>
        <p style="${styles.infoText}">✅ Kupost listings zako bure (hadi 2)</p>
        <p style="${styles.infoText}">✅ Kupokea wateja wa nyumba</p>
        <p style="${styles.infoText}">✅ Kutumia CRM dashboard</p>
        <p style="${styles.infoText}">✅ Trial ya wiki 2 ya Premium!</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center">
          <a href="${APP_URL}/dashboard" style="${styles.btn}">📤 Anza Kupost Listing →</a>
        </td></tr>
      </table>
      ` : `
      <div style="${styles.infoBox}">
        <p style="${styles.infoText}">🔍 <strong>Sasa unaweza:</strong></p>
        <p style="${styles.infoText}">✅ Kutafuta nyumba Tanzania yote</p>
        <p style="${styles.infoText}">✅ Kufungua contact ya dalali</p>
        <p style="${styles.infoText}">✅ Kuhifadhi listings unazozipenda</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center">
          <a href="${APP_URL}" style="${styles.btn}">🔍 Tafuta Nyumba Sasa →</a>
        </td></tr>
      </table>
      `}
    `, 'Karibu NyumbaFasta Tanzania!'),
  }
}

// ── Password reset email ───────────────────────────────────────────────────

export function passwordResetEmail(name: string, resetUrl: string) {
  return {
    subject: '🔐 Reset Password — NyumbaFasta',
    html: emailBase(`
      <span style="${styles.greeting}">Habari ${name}!</span>
      <span style="${styles.text}">Tumepokea ombi la kubadilisha password ya akaunti yako kwenye NyumbaFasta.</span>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center">
            <a href="${resetUrl}" style="${styles.btn}">🔐 Badilisha Password →</a>
          </td>
        </tr>
      </table>

      <div style="${styles.infoBox}">
        <p style="${styles.infoText}">⏰ Kitufe hiki kitafanya kazi kwa dakika 60 tu.</p>
      </div>

      <hr style="${styles.divider}">
      <span style="${styles.textSmall}">Kama hukuomba kubadilisha password — ignore email hii. Password yako haijabadilika.</span>
      <span style="${styles.textSmall};margin-top:12px">Kiungo hakifanyi kazi? Nakili na ubandike:</span>
      <a href="${resetUrl}" style="${styles.linkSmall}">${resetUrl}</a>
    `, 'Badilisha password yako ya NyumbaFasta'),
  }
}

// ── Listing approved email ─────────────────────────────────────────────────

export function listingApprovedEmail(dalaliName: string, listingTitle: string, listingUrl: string) {
  return {
    subject: '🏠 Listing Yako Imeidhinishwa!',
    html: emailBase(`
      <span style="${styles.greeting}">Hongera ${dalaliName}! 🎉</span>
      <span style="${styles.text}">Listing yako imeidhinishwa na ipo live sasa! Wateja wanaweza kuiona mara moja.</span>

      <div style="${styles.infoBox}">
        <p style="${styles.infoText}">🏠 <strong>${listingTitle}</strong></p>
        <p style="${styles.infoText}">✅ Status: Live na inaonekana</p>
        <p style="${styles.infoText}">⏰ Itaisha baada ya siku 90</p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center">
          <a href="${listingUrl}" style="${styles.btn}">👁️ Angalia Listing Yako →</a>
        </td></tr>
      </table>

      <span style="${styles.text}">💡 <strong>Tip:</strong> Boost listing yako ili ionekane juu zaidi na kupata wateja haraka!</span>
    `, 'Listing yako ya NyumbaFasta imeidhinishwa!'),
  }
}

// ── Contact unlock notification email ─────────────────────────────────────

export function contactUnlockEmail(dalaliName: string, clientName: string, listingTitle: string) {
  return {
    subject: '🔓 Mteja Amefungua Contact Yako!',
    html: emailBase(`
      <span style="${styles.greeting}">Habari ${dalaliName}! 🎉</span>
      <span style="${styles.text}">Mteja amefungua contact yako kupitia listing yako! Wasiliana nao haraka kabla hawajaenda kwa dalali mwingine.</span>

      <div style="${styles.infoBox}">
        <p style="${styles.infoText}">👤 <strong>Mteja:</strong> ${clientName}</p>
        <p style="${styles.infoText}">🏠 <strong>Listing:</strong> ${listingTitle}</p>
        <p style="${styles.infoText}">💰 <strong>Malipo:</strong> Tsh 2,000 ✅</p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center">
          <a href="${APP_URL}/dashboard" style="${styles.btn}">📞 Angalia Mawasiliano →</a>
        </td></tr>
      </table>

      <span style="${styles.textSmall}">💡 Jibu haraka — wateja wanaotafuta nyumba hawangoji muda mrefu!</span>
    `, 'Mteja amefungua contact yako!'),
  }
}
