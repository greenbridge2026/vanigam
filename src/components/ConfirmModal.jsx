import React from 'react';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText, cancelText }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div className="glass-card" style={{
        maxWidth: '450px',
        width: '95%',
        padding: '2rem',
        textAlign: 'center',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        margin: '0 1rem'
      }}>
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
            style={{ padding: '0.5rem 1.5rem', background: 'var(--danger)' }}
          >
            {confirmText || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
