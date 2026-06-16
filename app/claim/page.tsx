export default function ClaimPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header/Navigation */}
      <div className="border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-sm font-medium text-gray-900 tracking-wider">NORTH SHORE</h1>
            <h2 className="text-sm font-medium text-gray-900 tracking-wider">SIGN CO.</h2>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Badge */}
        <div className="text-center mb-8">
          <span className="inline-block px-4 py-2 bg-blue-50 text-blue-600 text-xs font-semibold tracking-wider">
            LIMITED OFFER — FREE FIRST INSTALL
          </span>
        </div>

        {/* Headline */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Sign Posts for
          </h1>
          <h2 className="text-4xl font-bold text-blue-600">
            Seattle Agents.
          </h2>
        </div>

        {/* Form Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-8 mb-12">
          {/* Highlight Box */}
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-8 flex items-start">
            <span className="text-2xl mr-3">🎁</span>
            <p className="text-gray-900 font-medium">
              First installation free — limited spots
            </p>
          </div>

          {/* Form */}
          <form id="claimForm" className="space-y-6">
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-semibold text-gray-900 mb-2">
                FULL NAME
              </label>
              <input
                type="text"
                id="fullName"
                placeholder="Jane Smith"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-semibold text-gray-900 mb-2">
                PHONE NUMBER
              </label>
              <input
                type="tel"
                id="phone"
                placeholder="(206) 555-0100"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-2">
                EMAIL
              </label>
              <input
                type="email"
                id="email"
                placeholder="jane@yourbrokerage.com"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Brokerage */}
            <div>
              <label htmlFor="brokerage" className="block text-sm font-semibold text-gray-900 mb-2">
                BROKERAGE
              </label>
              <input
                type="text"
                id="brokerage"
                placeholder="Windermere, Keller Williams..."
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              id="submitBtn"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition duration-200 text-lg"
            >
              Claim My Free Install →
            </button>

            {/* Status Message */}
            <div id="formStatus" className="text-center"></div>
          </form>

          {/* Footer Text */}
          <p className="text-center text-gray-600 text-sm mt-6">
            No spam. No contracts. We will call you within 24 hours.
          </p>
        </div>

        {/* Benefits Section */}
        <div className="mb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-600 rounded-lg font-bold text-lg mb-3">
                1
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Fill out the form</h3>
              <p className="text-gray-600 text-sm">Takes less than 60 seconds.</p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-600 rounded-lg font-bold text-lg mb-3">
                2
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">We reach out</h3>
              <p className="text-gray-600 text-sm">
                A real person calls or texts you within 24 hours to confirm your first job.
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-600 rounded-lg font-bold text-lg mb-3">
                3
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">We show up</h3>
              <p className="text-gray-600 text-sm">
                We install your sign post — fast, professional, free the first time.
              </p>
            </div>
          </div>
        </div>

        {/* What You Get Section */}
        <div className="mb-12">
          <div className="text-xs font-semibold text-blue-600 tracking-wider mb-3">WHAT YOU GET</div>
          <h3 className="text-3xl font-bold text-gray-900 mb-8">Everything handled for you</h3>

          <div className="space-y-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-green-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-lg font-bold text-gray-900">Sign Post Installation</h4>
                <p className="text-gray-600 text-sm">Professional install at your listing — fast and clean.</p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-green-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-lg font-bold text-gray-900">Sign Post Removal</h4>
                <p className="text-gray-600 text-sm">
                  We come back when the property closes. No leftover mess.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-green-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-lg font-bold text-gray-900">Next-Day Scheduling</h4>
                <p className="text-gray-600 text-sm">We work around your timeline.</p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-green-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-lg font-bold text-gray-900">All of Seattle & Surrounding Areas</h4>
                <p className="text-gray-600 text-sm">Serving agents across greater Seattle.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Benefits */}
        <div className="mb-12">
          <div className="flex items-center justify-center gap-8 mb-8 flex-wrap">
            <div className="flex items-center">
              <span className="text-2xl mr-2">🔒</span>
              <span className="text-gray-900 font-semibold">No contracts</span>
            </div>
            <div className="flex items-center">
              <span className="text-2xl mr-2">✅</span>
              <span className="text-gray-900 font-semibold">Licensed & insured</span>
            </div>
            <div className="flex items-center">
              <span className="text-2xl mr-2">📞</span>
              <span className="text-gray-900 font-semibold">Real person calls you</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 text-center text-gray-500 text-sm">
        <p>© 2026 North Shore Sign Co — Seattle, WA</p>
      </footer>

      {/* Include the claim.js script */}
      <script src="/claim.js"></script>
    </div>
  );
}
