import React, { useState, useEffect } from 'react';
import api from '../api';
import { Building2, Save, CheckCircle, Phone, MapPin, FileText, QrCode } from 'lucide-react';

export default function AgencySettings({ t, lang, onSettingsUpdated }) {
  const [settings, setSettings] = useState({
    company_name: 'GSK Agency',
    company_address: 'Cooldrinks Shop - Tindivanam',
    company_gst: '33CWRPK4071L1Z2',
    company_phone: '9345463415',
    upi_mobile: 'gskumar9345@okicici'
  });
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await api.getSettings();
        if (data) setSettings(data);
      } catch (err) {
        console.error('Failed to load agency settings:', err);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    try {
      await api.updateSettings(settings);
      if (settings.company_name) document.title = settings.company_name;
      if (onSettingsUpdated) onSettingsUpdated(settings);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      alert((lang === 'ta' ? 'அமைப்புகளை சேமிக்க முடியவில்லை: ' : 'Failed to save settings: ') + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="agency-settings-container" style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '2rem' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Building2 size={24} style={{ color: 'var(--accent-cyan)' }} />
            <span>{lang === 'ta' ? 'நிறுவன விவரங்கள் & பில்லிங் அமைப்புகள்' : 'Agency Profile & Billing Settings'}</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            {lang === 'ta' 
              ? 'உங்கள் நிறுவனத்தின் பெயர், முகவரி, ஜிஎஸ்டி மற்றும் யுபிஐ விவரங்களை நிர்வகிக்கவும்' 
              : 'Configure your company details, GSTIN, invoice letterhead, and UPI payment identifier'}
          </p>
        </div>

        {savedSuccess && (
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            padding: '0.45rem 0.9rem', 
            borderRadius: '8px', 
            background: 'rgba(16, 185, 129, 0.15)', 
            border: '1px solid var(--success)', 
            color: 'var(--success)',
            fontSize: '0.85rem',
            fontWeight: '600'
          }}>
            <CheckCircle size={16} />
            <span>{lang === 'ta' ? 'வெற்றிகரமாகச் சேமிக்கப்பட்டது!' : 'Settings Saved Successfully!'}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Settings Form */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: '600', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            {lang === 'ta' ? 'விவரங்களை உள்ளிடவும்' : 'Business Information'}
          </h2>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                <Building2 size={14} style={{ color: 'var(--accent-cyan)' }} />
                <span>{lang === 'ta' ? 'நிறுவனத்தின் பெயர்' : 'Company Name'} *</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={settings.company_name}
                onChange={e => setSettings({ ...settings, company_name: e.target.value })}
                required
                placeholder="e.g. GSK Agency"
                style={{ width: '100%' }}
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                <MapPin size={14} style={{ color: 'var(--accent-cyan)' }} />
                <span>{lang === 'ta' ? 'நிறுவன முகவரி' : 'Business Address'} *</span>
              </label>
              <textarea
                className="form-input"
                rows={3}
                value={settings.company_address}
                onChange={e => setSettings({ ...settings, company_address: e.target.value })}
                required
                placeholder="e.g. Cooldrinks Shop - Tindivanam"
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                <FileText size={14} style={{ color: 'var(--accent-cyan)' }} />
                <span>{lang === 'ta' ? 'ஜிஎஸ்டி எண் (GSTIN)' : 'GSTIN / Tax Number'}</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={settings.company_gst}
                onChange={e => setSettings({ ...settings, company_gst: e.target.value.toUpperCase() })}
                placeholder="e.g. 33CWRPK4071L1Z2"
                style={{ width: '100%' }}
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                <Phone size={14} style={{ color: 'var(--accent-cyan)' }} />
                <span>{lang === 'ta' ? 'மொபைல் / தொலைபேசி எண்' : 'Contact Mobile No'}</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={settings.company_phone || ''}
                onChange={e => setSettings({ ...settings, company_phone: e.target.value })}
                placeholder="e.g. 9345463415"
                style={{ width: '100%' }}
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                <QrCode size={14} style={{ color: 'var(--accent-cyan)' }} />
                <span>{lang === 'ta' ? 'யூபிஐ ஐடி (UPI ID / VPA)' : 'UPI ID / VPA (For Invoices)'}</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={settings.upi_mobile || ''}
                onChange={e => setSettings({ ...settings, upi_mobile: e.target.value })}
                placeholder="e.g. gskumar9345@okicici"
                style={{ width: '100%' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                {lang === 'ta' ? 'இவ்வெண் பில்களில் பணம் செலுத்த QR கோடாக காட்டப்படும்.' : 'Used for dynamic payment QR generation on customer invoices.'}
              </span>
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', width: '100%', justifyContent: 'center' }}
              >
                <Save size={16} />
                <span>{saving ? (lang === 'ta' ? 'சேமிக்கப்படுகிறது...' : 'Saving...') : (lang === 'ta' ? 'அமைப்புகளைச் சேமி' : 'Save Settings')}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Live Preview Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem', height: 'fit-content' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '600', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              {lang === 'ta' ? 'பில் தலைப்பு நேரலை முன்னோட்டம்' : 'Live Invoice Header Preview'}
            </h2>
            <div style={{ 
              background: 'var(--bg-card)', 
              border: '1px dashed var(--border-color)', 
              borderRadius: '8px', 
              padding: '1.25rem',
              textAlign: 'center'
            }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--accent-cyan)', letterSpacing: '0.5px' }}>
                {settings.company_name || 'Your Company Name'}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem', whiteSpace: 'pre-line' }}>
                {settings.company_address || 'Company Address Line'}
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.6rem', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                {settings.company_gst && <span><strong>GSTIN:</strong> {settings.company_gst}</span>}
                {settings.company_phone && <span><strong>Phone:</strong> {settings.company_phone}</span>}
              </div>
              {settings.upi_mobile && (
                <div style={{ marginTop: '0.75rem', padding: '0.4rem 0.75rem', background: 'rgba(6, 182, 212, 0.08)', borderRadius: '6px', display: 'inline-block', fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                  💳 UPI: <strong>{settings.upi_mobile}</strong>
                </div>
              )}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem', textAlign: 'center' }}>
              {lang === 'ta' ? 'அனைத்து அச்சிடப்பட்ட ரசீதுகளிலும் இந்நேரடி தலைப்பு பயன்படுத்தப்படும்.' : 'This header will appear on all customer tax invoices and delivery receipts.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

