import Link from 'next/link'

export default function NoAccessPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <div className="text-6xl mb-4">🔒</div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">
        Huna Ruhusa ya Kufikia Hapa
      </h1>
      <p className="text-gray-500 text-sm max-w-sm mb-6 leading-relaxed">
        Sehemu hii inahitaji ruhusa maalum. Wasiliana na admin wako ili aweze kukupa ufikiaji wa sehemu hii.
      </p>
      <Link
        href="/admin/staff-leads"
        className="bg-[#1D9E75] text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
      >
        ← Rudi kwenye Dashboard
      </Link>
    </div>
  )
}
