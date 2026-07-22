import React from 'react';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText, cancelText }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="glass-card modal-card modal-confirm">
        <h3 style={{
          fontSize: '1.4rem',
          fontWeight: '700',
          marginBottom: '1rem',
          color: 'var(--danger)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem'
        }}>
          ⚠️ {title || 'Confirm Action'}
        </h3>
        <p style={{
          color: 'var(--text-muted)',
          fontSize: '0.95rem',
          lineHeight: '1.5',
          marginBottom: '2rem'
        }}>
          {message}
        </p>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1rem'
        }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            style={{ padding: '0.5rem 1.5rem' }}
          >
            {cancelText || 'Cancel'}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            style={{ padding: '0.5rem 1.5rem', background: 'var(--danger)', color: '#ffffff' }}
          >
            {confirmText || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
