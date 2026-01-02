import { ExternalLink, X, Heart } from 'lucide-react'

interface AttributionModalProps {
  onClose: () => void
}

export function AttributionModal({ onClose }: AttributionModalProps) {
  const handleVisitStore = () => {
    window.open('https://guinto2.gumroad.com/l/dxvkstudio', '_blank')
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md animate-slide-up">
        <div className="glass-card p-6 m-4 border-accent-vulkan/30 bg-studio-900/95 backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <img src="/icon.png" alt="DXVK Studio" className="w-12 h-12 rounded-xl shadow-lg" />
              <div>
                <h2 className="text-xl font-bold text-white">DXVK Studio</h2>
                <p className="text-sm text-studio-400">Professional DXVK Manager</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="btn-icon-subtle text-studio-500 hover:text-studio-300"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-4 mb-6">
            <div className="bg-accent-vulkan/10 border border-accent-vulkan/20 rounded-lg p-4">
              <p className="text-sm text-studio-200 leading-relaxed">
                Made with <Heart className="w-3.5 h-3.5 inline text-accent-danger fill-accent-danger" /> by{' '}
                <button
                  onClick={handleVisitStore}
                  className="text-accent-vulkan hover:text-accent-vulkan/80 font-semibold underline decoration-accent-vulkan/30 hover:decoration-accent-vulkan/60 transition-colors"
                >
                  Zendevve
                </button>
              </p>
            </div>

            <p className="text-sm text-studio-400 leading-relaxed">
              This is official software distributed by the creator. If you didn't get this from the
              official store, please verify your source to ensure you have the legitimate version.
            </p>

            <div className="bg-studio-800/50 border border-studio-700 rounded-lg p-3">
              <p className="text-xs text-studio-500 leading-relaxed">
                <strong className="text-studio-400">Note:</strong> Unofficial redistributions may contain
                modified or malicious code. Always download from official sources.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleVisitStore}
              className="btn-primary flex items-center gap-2 flex-1 justify-center"
            >
              <ExternalLink className="w-4 h-4" />
              Visit Official Store
            </button>
            <button
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Continue
            </button>
          </div>

          {/* Footer */}
          <div className="mt-4 pt-4 border-t border-studio-700/50 flex items-center justify-between">
            <p className="text-xs text-studio-600">
              © 2024-2026 Zendevve
            </p>
            <button
              onClick={onClose}
              className="text-xs text-studio-500 hover:text-studio-400 transition-colors"
            >
              Don't show again today
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
