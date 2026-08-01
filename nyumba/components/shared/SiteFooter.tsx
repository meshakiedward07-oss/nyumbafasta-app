import Link from 'next/link'

export default function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-gray-100 bg-white py-8 px-6 mt-4 pb-24 lg:pb-8">
      <div className="max-w-screen-xl mx-auto">
        {/* Desktop: 3-column layout */}
        <div className="hidden lg:grid lg:grid-cols-3 gap-8 mb-8">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">NyumbaFasta</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Platform inayowakutanisha madalali wa nyumba na wateja Tanzania nzima.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Viungo</p>
            <div className="space-y-2">
              <Link href="/" className="block text-xs text-gray-500 hover:text-primary-600 hover:underline">Tafuta Nyumba</Link>
              <Link href="/directory" className="block text-xs text-gray-500 hover:text-primary-600 hover:underline">Madalali</Link>
              <Link href="/register" className="block text-xs text-gray-500 hover:text-primary-600 hover:underline">Jiandikishe kama Dalali</Link>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Msaada</p>
            <div className="space-y-2">
              <Link href="/terms" className="block text-xs text-gray-500 hover:text-primary-600 hover:underline">Terms of Service</Link>
              <Link href="/privacy" className="block text-xs text-gray-500 hover:text-primary-600 hover:underline">Privacy Policy</Link>
              <Link href="/data-deletion" className="block text-xs text-gray-500 hover:text-primary-600 hover:underline">Data Deletion</Link>
              <a href="mailto:support@nyumbafasta.co" className="block text-xs text-gray-500 hover:text-primary-600 hover:underline">support@nyumbafasta.co</a>
            </div>
          </div>
        </div>

        {/* Mobile: centered links */}
        <div className="lg:hidden flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-500 mb-3">
          <Link href="/terms" className="hover:text-primary-600 hover:underline">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-primary-600 hover:underline">Privacy Policy</Link>
          <Link href="/data-deletion" className="hover:text-primary-600 hover:underline">Data Deletion</Link>
          <a href="mailto:support@nyumbafasta.co" className="hover:text-primary-600 hover:underline">Contact Us</a>
        </div>

        <div className="border-t border-gray-100 lg:pt-6 pt-3">
          <p className="text-center text-xs text-gray-400">
            © {year} NyumbaFasta Tanzania · All rights reserved
          </p>
        </div>
      </div>
    </footer>
  )
}
