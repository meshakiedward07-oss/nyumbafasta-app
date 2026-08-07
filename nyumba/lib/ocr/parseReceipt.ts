// Receipt OCR parsing utilities.
// OCR runs client-side via Tesseract.js (free, on-device, no API keys).
// Text is then parsed with regex patterns tuned for Tanzanian mobile money receipts.

export interface ParsedReceipt {
  amount:     number | null
  date:       string | null   // ISO YYYY-MM-DD
  reference:  string | null
  method:     string | null   // mpesa | airtel | tigopesa | halopesa | cash | bank_transfer | other
  confidence: 'high' | 'medium' | 'low'
  raw_text:   string
}

// ── Text parsing (regex) ─────────────────────────────────────────────────────

export function parseReceiptText(raw: string): ParsedReceipt {
  const text = raw.toUpperCase()

  // ── Payment method ────────────────────────────────────────────────────────
  let method: string | null = null
  if (/M[\s-]?PESA|VODACOM\s*M[\s-]?PESA/.test(text))       method = 'mpesa'
  else if (/AIRTEL\s*MONEY|AIRTELMONEY/.test(text))          method = 'airtel'
  else if (/TIGO[\s-]?PESA|TIGOPESA/.test(text))             method = 'tigopesa'
  else if (/HALO[\s-]?PESA|HALOPESA/.test(text))             method = 'halopesa'
  else if (/BENKI|BANK\s*TRANSFER|CRDB|NMB|STANBIC|NBC\b/.test(text)) method = 'bank_transfer'

  // ── Amount ────────────────────────────────────────────────────────────────
  // Patterns: "TZS 500,000.00", "Tsh 500,000", "Kiasi: 500000", "Amount 500000"
  const amountPatterns = [
    /(?:TZS|TSH|SH\.?)\s*([0-9]{1,3}(?:[,.\s][0-9]{3})*(?:\.[0-9]{1,2})?)/i,
    /(?:KIASI|AMOUNT|JUMLA)[:\s]+([0-9]{1,3}(?:[,.\s][0-9]{3})*(?:\.[0-9]{1,2})?)/i,
    /ULILIPIA\s+([0-9]{1,3}(?:[,.\s][0-9]{3})*)/i,
    /SENT\s+([0-9]{1,3}(?:[,.\s][0-9]{3})*)/i,
    /RECEIVED\s+([0-9]{1,3}(?:[,.\s][0-9]{3})*)/i,
  ]
  let amount: number | null = null
  for (const pat of amountPatterns) {
    const m = raw.match(pat)
    if (m?.[1]) {
      const cleaned = m[1].replace(/[,\s]/g, '').replace(/\.(\d{2})$/, '')
      const n = parseFloat(cleaned)
      if (!isNaN(n) && n > 0) { amount = Math.round(n); break }
    }
  }
  // Fallback: largest standalone number (>= 1000) that looks like money
  if (!amount) {
    const nums = [...raw.matchAll(/\b([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?)\b/g)]
      .map(m => parseFloat(m[1].replace(/,/g, '')))
      .filter(n => n >= 1000)
    if (nums.length) amount = Math.round(Math.max(...nums))
  }

  // ── Transaction reference ─────────────────────────────────────────────────
  // M-Pesa TZ: "SM..." or "RN..." or "P..." + 10-15 digits
  // Generic: labelled "Transaction ID", "Ref", "Reference", "No."
  const refPatterns = [
    /(?:TRANSACTION\s*(?:ID|NO\.?)|REFERENCE|REF(?:ERENCE)?\.?|NAMBARI\s*YA\s*MUAMALA|UTHIBITISHO)[:\s#]+([A-Z0-9]{6,20})/i,
    /\b([A-Z]{1,3}[0-9]{8,15})\b/,    // e.g. RN12345678901, SM12345678901
    /\b([0-9]{10,16})\b/,              // numeric transaction IDs
  ]
  let reference: string | null = null
  for (const pat of refPatterns) {
    const m = raw.match(pat)
    if (m?.[1]) { reference = m[1].trim().toUpperCase(); break }
  }

  // ── Date ─────────────────────────────────────────────────────────────────
  // Many formats: DD/MM/YYYY, YYYY-MM-DD, DD-Mon-YYYY, DD Month YYYY
  let date: string | null = null
  const monthNames: Record<string, string> = {
    JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',
    JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12',
    JANUARI:'01',FEBRUARI:'02',MACHI:'03',APRILI:'04',MEI:'05',
    JUNI:'06',JULAI:'07',AGOSTI:'08',SEPTEMBA:'09',OKTOBA:'10',
    NOVEMBA:'11',DESEMBA:'12',
  }

  // YYYY-MM-DD
  const iso = raw.match(/\b(202[0-9]-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01]))\b/)
  if (iso) {
    date = iso[1]
  } else {
    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = raw.match(/\b(0?[1-9]|[12][0-9]|3[01])[\/\-](0?[1-9]|1[0-2])[\/\-](202[0-9])\b/)
    if (dmy) {
      date = `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`
    } else {
      // DD Month YYYY or DD-Mon-YYYY
      const dMonth = raw.match(/\b(0?[1-9]|[12][0-9]|3[01])[\s\-]([A-Za-z]+)[\s\-,]+(202[0-9])\b/)
      if (dMonth) {
        const mon = monthNames[dMonth[2].toUpperCase().slice(0, 8)]
        if (mon) date = `${dMonth[3]}-${mon}-${dMonth[1].padStart(2,'0')}`
      }
    }
  }
  // Validate date is not in the future
  if (date) {
    const d = new Date(date)
    if (isNaN(d.getTime()) || d > new Date()) date = null
  }

  // ── Confidence ───────────────────────────────────────────────────────────
  const found = [amount, date, reference, method].filter(Boolean).length
  const confidence: 'high'|'medium'|'low' = found >= 3 ? 'high' : found >= 2 ? 'medium' : 'low'

  return { amount, date, reference, method, confidence, raw_text: raw }
}

// ── Client-side Tesseract OCR ─────────────────────────────────────────────────
// Runs in the browser using a Tesseract.js Web Worker.
// Language data (~4MB for eng) is fetched once and cached in IndexedDB.

export async function runOCR(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  // Dynamic import so Tesseract is not bundled server-side
  const { createWorker } = await import('tesseract.js')

  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100))
      }
    },
  })

  try {
    const { data } = await worker.recognize(file)
    return data.text
  } finally {
    await worker.terminate()
  }
}

// Convenience: OCR + parse in one call
export async function ocrAndParse(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<ParsedReceipt> {
  const raw = await runOCR(file, onProgress)
  return parseReceiptText(raw)
}
