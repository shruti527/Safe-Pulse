import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

// Native Contact Picker API — only available on Chrome for Android
const isContactPickerSupported = () =>
  typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;

export default function AddContactModal({ onClose, onSubmit, errorMessage }) {
  const [input, setInput] = useState('');
  const [tab, setTab] = useState('manual'); // 'manual' | 'phonebook'
  const [pickedContacts, setPickedContacts] = useState([]); // [{ name, value }]
  const [pickError, setPickError] = useState('');
  const [picking, setPicking] = useState(false);
  const [sending, setSending] = useState(false);

  // Desktop batch-add form state
  const [batchName, setBatchName] = useState('');
  const [batchValue, setBatchValue] = useState('');
  const [batchError, setBatchError] = useState('');
  const batchValueRef = useRef(null);

  const contactPickerSupported = isContactPickerSupported();

  // Lock page scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'visible';
    document.documentElement.style.overflow = 'visible';
    return () => {
      document.body.style.overflow = prev;
      document.documentElement.style.overflow = '';
    };
  }, []);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) onSubmit(input.trim());
  };

  // ── Native picker (mobile Chrome only) ──────────────────────────────────────
  const handlePickFromPhone = async () => {
    setPickError('');
    setPicking(true);
    try {
      const results = await navigator.contacts.select(['name', 'tel', 'email'], { multiple: true });
      const mapped = results
        .map((c) => {
          const name = c.name?.[0] || 'Unknown';
          const value = c.tel?.[0] || c.email?.[0] || '';
          return value ? { name, value } : null;
        })
        .filter(Boolean);

      if (mapped.length === 0) {
        setPickError('No phone number or email found for the selected contact(s).');
      } else {
        setPickedContacts((prev) => {
          const existing = new Set(prev.map((c) => c.value));
          return [...prev, ...mapped.filter((c) => !existing.has(c.value))];
        });
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setPickError('Could not open contacts. Try using the form below instead.');
      }
    } finally {
      setPicking(false);
    }
  };

  // ── Desktop batch-add form ───────────────────────────────────────────────────
  const handleBatchAdd = (e) => {
    e.preventDefault();
    setBatchError('');
    const val = batchValue.trim();
    const name = batchName.trim() || val;
    if (!val) {
      setBatchError('Please enter a phone number or email.');
      return;
    }
    const alreadyExists = pickedContacts.some((c) => c.value === val);
    if (alreadyExists) {
      setBatchError('This contact is already in the list.');
      return;
    }
    setPickedContacts((prev) => [...prev, { name, value: val }]);
    setBatchName('');
    setBatchValue('');
    // Refocus value input so the user can quickly add the next one
    setTimeout(() => batchValueRef.current?.focus(), 0);
  };

  // ── Shared ───────────────────────────────────────────────────────────────────
  const handleRemovePicked = (value) => {
    setPickedContacts((prev) => prev.filter((c) => c.value !== value));
  };

  const handleSendPickedRequests = async () => {
    if (sending || pickedContacts.length === 0) return;
    setSending(true);
    try {
      for (const c of pickedContacts) {
        await onSubmit(c.value, { silent: true });
      }
    } finally {
      setSending(false);
      onClose();
    }
  };

  // ─── Styles ─────────────────────────────────────────────────────────────────
  const s = {
    overlay: {
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
    },
    card: {
      background: '#fff', borderRadius: '16px', padding: '24px',
      width: '100%', maxWidth: '420px', margin: '0 16px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)', animation: 'spFadeUp 0.18s ease',
      maxHeight: '90vh', overflowY: 'auto',
    },
    tabBar: {
      display: 'flex', background: '#f3f4f6', borderRadius: '10px',
      padding: '3px', marginBottom: '18px', gap: '3px',
    },
    tab: (active) => ({
      flex: 1, padding: '8px 0', borderRadius: '8px', border: 'none',
      cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all .15s',
      background: active ? '#fff' : 'transparent',
      color: active ? '#2563eb' : '#6b7280',
      boxShadow: active ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
    }),
    input: {
      width: '100%', padding: '11px 14px', borderRadius: '10px',
      border: '1.5px solid #e5e7eb', fontSize: '14px', outline: 'none',
      background: '#f9fafb', boxSizing: 'border-box', transition: 'border-color .15s',
    },
    btnSecondary: {
      padding: '10px 18px', borderRadius: '12px', border: '1.5px solid #e5e7eb',
      background: '#f9fafb', cursor: 'pointer', fontSize: '14px',
      fontWeight: 500, color: '#374151',
    },
    btnPrimary: {
      padding: '10px 20px', borderRadius: '12px', border: 'none',
      background: '#2563eb', color: '#fff', cursor: 'pointer',
      fontSize: '14px', fontWeight: 600, boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
    },
    btnPrimaryDisabled: {
      padding: '10px 20px', borderRadius: '12px', border: 'none',
      background: '#93c5fd', color: '#fff', cursor: 'not-allowed',
      fontSize: '14px', fontWeight: 600,
    },
    btnSmall: {
      padding: '9px 14px', borderRadius: '10px', border: 'none',
      background: '#2563eb', color: '#fff', cursor: 'pointer',
      fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap',
      flexShrink: 0,
    },
    errorBox: {
      padding: '8px 12px', background: '#fee2e2',
      color: '#dc2626', borderRadius: '8px', fontSize: '13px',
    },
    infoBox: {
      padding: '8px 12px', background: '#eff6ff',
      color: '#1d4ed8', borderRadius: '8px', fontSize: '12px',
      display: 'flex', alignItems: 'center', gap: '6px',
    },
    contactChip: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '9px 12px', background: '#f0f7ff', borderRadius: '10px',
      border: '1px solid #bfdbfe',
    },
    pickBtn: {
      width: '100%', padding: '13px', borderRadius: '12px', border: '1.5px dashed #93c5fd',
      background: '#eff6ff', color: '#2563eb', cursor: picking ? 'wait' : 'pointer',
      fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center',
      justifyContent: 'center', gap: '8px',
    },
  };

  // ─── Chip list (shared between native and desktop flows) ─────────────────────
  const ChipList = () => (
    pickedContacts.length > 0 ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>
          {pickedContacts.length} contact{pickedContacts.length > 1 ? 's' : ''} — a request will be sent to each.
        </p>
        {pickedContacts.map((c) => (
          <div key={c.value} style={s.contactChip}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>{c.value}</div>
            </div>
            <button
              onClick={() => handleRemovePicked(c.value)}
              disabled={sending}
              style={{ background: 'none', border: 'none', cursor: sending ? 'not-allowed' : 'pointer', color: '#9ca3af', padding: '2px', flexShrink: 0, marginLeft: '8px' }}
              aria-label={`Remove ${c.name}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
            </button>
          </div>
        ))}
      </div>
    ) : null
  );

  const modal = (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={s.overlay}>
      <div style={s.card}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111', margin: 0 }}>
            Add Trusted Contact
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }} aria-label="Close">
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#888' }}>close</span>
          </button>
        </div>

        {/* Tabs — label adapts to platform */}
        <div style={s.tabBar}>
          <button style={s.tab(tab === 'manual')} onClick={() => setTab('manual')}>
            ✏️ Manual Entry
          </button>
          <button style={s.tab(tab === 'phonebook')} onClick={() => setTab('phonebook')}>
            {contactPickerSupported ? '📱 From Contacts' : '📋 Batch Add'}
          </button>
        </div>

        {/* Global error (from parent) */}
        {errorMessage && <div style={{ ...s.errorBox, marginBottom: '12px' }}>{errorMessage}</div>}

        {/* ── Manual tab ── */}
        {tab === 'manual' && (
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input
              type="text"
              placeholder="Email or phone number"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
              required
              style={s.input}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={onClose} style={s.btnSecondary}>Cancel</button>
              <button type="submit" style={s.btnPrimary}>Send Request</button>
            </div>
          </form>
        )}

        {/* ── Phonebook / Batch Add tab ── */}
        {tab === 'phonebook' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* ── Android: native OS contact picker ── */}
            {contactPickerSupported ? (
              <>
                <button onClick={handlePickFromPhone} disabled={picking || sending} style={s.pickBtn}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>contacts</span>
                  {picking ? 'Opening contacts…' : 'Choose from phone contacts'}
                </button>
                {pickError && <div style={s.errorBox}>{pickError}</div>}
                <ChipList />
              </>
            ) : (
              /* ── Desktop: batch-add form ── */
              <>
                <div style={{ ...s.infoBox, marginBottom: '2px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>group_add</span>
                  Add multiple contacts at once, then send all requests together.
                </div>

                <form onSubmit={handleBatchAdd} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Name (optional)"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    style={s.input}
                    disabled={sending}
                  />
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                    <input
                      ref={batchValueRef}
                      type="text"
                      placeholder="Phone number or email *"
                      value={batchValue}
                      onChange={(e) => { setBatchValue(e.target.value); setBatchError(''); }}
                      style={{ ...s.input, flex: 1 }}
                      disabled={sending}
                      required
                    />
                    <button type="submit" style={s.btnSmall} disabled={sending}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', verticalAlign: 'middle' }}>add</span>
                    </button>
                  </div>
                  {batchError && <div style={s.errorBox}>{batchError}</div>}
                </form>

                {/* Chip list */}
                <ChipList />
              </>

            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button type="button" onClick={onClose} disabled={sending} style={s.btnSecondary}>
                Cancel
              </button>
              <button
                onClick={handleSendPickedRequests}
                disabled={pickedContacts.length === 0 || sending}
                style={pickedContacts.length === 0 || sending ? s.btnPrimaryDisabled : s.btnPrimary}
              >
                {sending
                  ? 'Sending…'
                  : pickedContacts.length === 0
                    ? 'Send Requests'
                    : `Send ${pickedContacts.length} Request${pickedContacts.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spFadeUp {
          from { opacity: 0; transform: translateY(18px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
}