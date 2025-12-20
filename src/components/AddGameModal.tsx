import './AddGameModal.css'

interface AddGameModalProps {
  onClose: () => void
  onSelectExecutable: () => void
}

export function AddGameModal({ onClose, onSelectExecutable }: AddGameModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Game Manually</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <p className="text-secondary">
            Select a game executable (.exe) to add it to your library.
            DXVK Studio will analyze the file to detect its architecture and DirectX version.
          </p>

          <div className="modal-actions">
            <button className="btn btn-primary" onClick={onSelectExecutable}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                <polyline points="13,2 13,9 20,9" />
              </svg>
              Select Executable
            </button>
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
