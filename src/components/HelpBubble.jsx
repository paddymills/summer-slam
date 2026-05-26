import { useState, useRef, useEffect } from 'react';

export default function HelpBubble({ title, children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const popRef = useRef(null);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({
        top:  r.bottom + 8,
        left: Math.max(8, Math.min(r.left, window.innerWidth - 284)),
      });
    }
    setOpen(v => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (!btnRef.current?.contains(e.target) && !popRef.current?.contains(e.target))
        setOpen(false);
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label="Help"
        style={{
          width: 17, height: 17,
          borderRadius: '50%',
          border: '1.5px solid var(--header-bg)',
          background: open ? 'var(--card-bg)' : 'transparent',
          color: 'var(--header-bg)',
          fontSize: 10, fontWeight: 800,
          cursor: 'pointer',
          padding: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          verticalAlign: 'middle',
          marginLeft: 6,
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        ?
      </button>
      {open && (
        <div
          ref={popRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 800,
            background: 'var(--navy-mid)',
            border: '1px solid var(--card-border)',
            borderRadius: 10,
            padding: '13px 15px',
            width: 276,
            maxWidth: 'calc(100vw - 16px)',
            boxShadow: 'var(--card-shadow)',
            fontSize: 13,
            lineHeight: 1.65,
          }}
        >
          {title && (
            <div style={{ fontWeight: 700, color: 'var(--gold-light)', marginBottom: 8, fontSize: 13 }}>
              {title}
            </div>
          )}
          <div style={{ color: 'var(--header-bg)' }}>{children}</div>
        </div>
      )}
    </>
  );
}
