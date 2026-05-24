import { useState, useCallback, useEffect, useRef } from 'react';

function ConfirmDialog({ message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }) {
  const overlayDownRef = useRef(false);
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onCancel]);
  return (
    <div
      className="edit-overlay"
      onPointerDown={e => { overlayDownRef.current = e.target === e.currentTarget; }}
      onPointerUp={e => { if (overlayDownRef.current && e.target === e.currentTarget) onCancel(); }}
    >
      <div className="edit-panel" style={{ maxWidth: 400 }}>
        <div className="edit-panel-inner">
          <div className="edit-panel-header">
            <h3>Confirm</h3>
            <button className="edit-panel-close" onClick={onCancel}>✕</button>
          </div>
          <p style={{ color: 'var(--header-bg)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>{message}</p>
          <div className="edit-panel-actions">
            <button type="button" className="btn btn-outline btn-lg" onClick={onCancel}>{cancelLabel}</button>
            <button type="button" className={`btn btn-lg ${danger ? 'btn-danger' : 'btn-gold'}`} onClick={onConfirm}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const [state, setState] = useState(null);

  const confirm = useCallback((message, opts = {}) => {
    return new Promise(resolve => {
      setState({ message, resolve, ...opts });
    });
  }, []);

  const handleChoice = useCallback(result => {
    setState(prev => { if (prev) prev.resolve(result); return null; });
  }, []);

  const confirmDialog = state ? (
    <ConfirmDialog
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      danger={state.danger}
      onConfirm={() => handleChoice(true)}
      onCancel={() => handleChoice(false)}
    />
  ) : null;

  return { confirm, confirmDialog };
}
