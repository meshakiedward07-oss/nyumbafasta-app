import Link from 'next/link'

export default function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-gray-100 bg-white py-6 px-4 mt-4">
      <div className="max-w-2xl mx-auto">
        {/* Legal links — required to be visible from homepage for TikTok / Meta app review */}
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-500">
          <Link href="/terms" className="hover:text-primary-600 hover:underline">
            Terms of Service
          </Link>
          <Link href="/privacy" className="hover:text-primary-600 hover:underline">
            Privacy Policy
          </Link>
          <Link href="/data-deletion" className="hover:text-primary-600 hover:underline">
            Data Deletion
          </Link>
          <a
            href="mailto:support@nyumbafasta.co"
            className="hover:text-primary-600 hover:underline"
          >
            Contact Us
          </a>
        </div>
        <p className="text-center text-xs text-gray-400 mt-3">
          © {year} NyumbaFasta Tanzania · All rights reserved
        </p>
      </div>
    </footer>
  )
}
