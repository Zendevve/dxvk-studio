import { useState } from 'react'
import { Gamepad2, Search, ChevronRight, Check } from 'lucide-react'

interface OnboardingWizardProps {
  onComplete: () => void
  onScanGames: () => Promise<void>
}

const steps = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'scan', title: 'Find Games' },
  { id: 'done', title: 'Ready' },
]

export function OnboardingWizard({ onComplete, onScanGames }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isScanning, setIsScanning] = useState(false)
  const [gamesFound, setGamesFound] = useState<number | null>(null)

  const handleScan = async () => {
    setIsScanning(true)
    try {
      await onScanGames()
      const saved = localStorage.getItem('dxvk-studio-games')
      const games = saved ? JSON.parse(saved) : []
      setGamesFound(games.length)
    } catch (e) {
      console.error('Scan failed:', e)
    } finally {
      setIsScanning(false)
    }
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleFinish = () => {
    localStorage.setItem('dxvk-studio-onboarded', 'true')
    onComplete()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-studio-950/95 backdrop-blur-xl">
      <div className="w-full max-w-lg mx-4">
        {/* Card */}
        <div className="glass-card overflow-hidden border border-accent-vulkan/20">
          {/* Progress indicator */}
          <div className="px-8 pt-6 pb-4 bg-gradient-to-b from-accent-vulkan/5 to-transparent border-b border-white/5">
            <div className="flex items-center justify-between">
              {steps.map((step, i) => (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${i < currentStep
                          ? 'bg-accent-vulkan text-white shadow-glow-sm shadow-accent-vulkan/50'
                          : i === currentStep
                            ? 'bg-accent-vulkan/20 text-accent-vulkan border-2 border-accent-vulkan'
                            : 'bg-studio-900/80 text-studio-500 border border-studio-700'
                        }`}
                    >
                      {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
                    </div>
                    <span className={`mt-1.5 text-xs font-medium ${i <= currentStep ? 'text-white' : 'text-studio-500'
                      }`}>
                      {step.title}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-3 mt-[-18px] transition-colors duration-300 ${i < currentStep ? 'bg-accent-vulkan' : 'bg-studio-800'
                        }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step content */}
          <div className="p-8 text-center">
            {/* Step 1: Welcome */}
            {currentStep === 0 && (
              <div className="animate-fade-in space-y-6">
                <div className="w-24 h-24 mx-auto">
                  <img
                    src="/icon.png"
                    alt="DXVK Studio"
                    className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]"
                  />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">Welcome to DXVK Studio</h2>
                  <p className="text-studio-300">
                    Let's set up your environment in just a few steps.
                  </p>
                </div>
                <button onClick={handleNext} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                  Get Started
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Step 2: Scan */}
            {currentStep === 1 && (
              <div className="animate-fade-in space-y-6">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-accent-vulkan/10 border border-accent-vulkan/30 flex items-center justify-center">
                  <Search className="w-10 h-10 text-accent-vulkan" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">Find Your Games</h2>
                  <p className="text-studio-300">
                    We'll scan for Steam, GOG, and Epic games on your system.
                  </p>
                </div>

                {gamesFound !== null ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-accent-success/10 border border-accent-success/30">
                      <p className="text-accent-success font-medium">
                        Found {gamesFound} game{gamesFound !== 1 ? 's' : ''}!
                      </p>
                    </div>
                    <button onClick={handleNext} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                      Continue
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={handleScan}
                      disabled={isScanning}
                      className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                    >
                      {isScanning ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Scanning...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4" />
                          Scan for Games
                        </>
                      )}
                    </button>
                    <button onClick={handleNext} className="text-studio-400 hover:text-white text-sm transition-colors">
                      Skip for now
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Done */}
            {currentStep === 2 && (
              <div className="animate-fade-in space-y-6">
                <div className="w-24 h-24 mx-auto">
                  <img
                    src="/icon.png"
                    alt="DXVK Studio"
                    className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]"
                  />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">You're All Set!</h2>
                  <p className="text-studio-300">
                    DXVK Studio is ready. Start managing your games with Vulkan power.
                  </p>
                </div>
                <button onClick={handleFinish} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                  <Gamepad2 className="w-4 h-4" />
                  Enter DXVK Studio
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
