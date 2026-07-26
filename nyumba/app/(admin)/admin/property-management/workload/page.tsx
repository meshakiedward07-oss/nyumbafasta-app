export const metadata = { title: 'Mzigo wa Wafanyakazi — Admin' }

export default function Page() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Mzigo wa Wafanyakazi</h1>
      <p className="text-sm text-gray-400 mb-8">Sehemu hii inakamilishwa — itapatikana hivi karibuni.</p>
      <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-12 text-center">
        <i className="ti ti-tools text-5xl text-gray-200" aria-hidden="true" />
        <p className="text-gray-400 mt-3 text-sm">Inakuja katika awamu inayofuata</p>
      </div>
    </div>
  )
}
