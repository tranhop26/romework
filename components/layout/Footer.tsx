export function Footer() {
  return (
    <footer className="w-full border-t border-slate-200 bg-white py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} RomeWork · adapted from FreelanceGuard
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="https://github.com/tranhop26/freelanceguard" target="_blank" rel="noopener noreferrer" className="hover:text-blue-700 transition-colors">
              Original source
            </a>
            <a href="https://docs.rome.builders" target="_blank" rel="noopener noreferrer" className="hover:text-blue-700 transition-colors">
              Rome docs
            </a>
            <a href="https://via-hadrian.testnet.romeprotocol.xyz/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-700 transition-colors">
              Hadrian explorer
            </a>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 border border-slate-200">
            Hadrian Testnet · G0
          </div>
        </div>
      </div>
    </footer>
  );
}
