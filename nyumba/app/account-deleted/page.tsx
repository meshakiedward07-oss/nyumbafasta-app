import Link from 'next/link'
import Image from 'next/image'

export default function AccountDeletedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-sm w-full">
        <div className="relative h-10 w-32 mx-auto mb-6">
          <Image src="/transparent_logo_nyumbafasta.png" alt="NyumbaFasta" fill className="object-contain" sizes="128px" />
        </div>
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="ti ti-check text-gray-500 text-3xl" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Akaunti Imefutwa</h1>
        <p className="text-sm text-gray-500 mb-6">
          Akaunti yako na data yako yote imefutwa. Asante kwa kutumia NyumbaFasta.
        </p>
        <Link
          href="/"
          className="w-full inline-flex items-center justify-center gap-2 bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 transition"
        >
          <i className="ti ti-home" aria-hidden="true" /> Rudi Nyumbani
        </Link>
      </div>
    </div>
  )
}
