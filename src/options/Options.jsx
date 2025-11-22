import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'

function Options() {
    const [url, setUrl] = useState('')
    const [backgroundSync, setBackgroundSync] = useState(true) // Default to true
    const [status, setStatus] = useState('')

    useEffect(() => {
        // Restore options from chrome.storage
        chrome.storage.sync.get(['samlUrl', 'backgroundSync'], (items) => {
            if (items.samlUrl) {
                setUrl(items.samlUrl)
            }
            // Default to true if not set
            setBackgroundSync(items.backgroundSync !== undefined ? items.backgroundSync : true)
        })
    }, [])

    const saveOptions = () => {
        chrome.storage.sync.set({
            samlUrl: url,
            backgroundSync: backgroundSync
        }, () => {
            setStatus('Options saved.')
            setTimeout(() => {
                setStatus('')
            }, 750)
        })
    }

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', minWidth: '300px' }}>
            <h1>AWS SAML Sign-In Aid</h1>
            <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>
                    SAML Token URL:
                </label>
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    placeholder="https://example.com/saml"
                />
            </div>
            <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={backgroundSync}
                        onChange={(e) => setBackgroundSync(e.target.checked)}
                        style={{ marginRight: '8px', cursor: 'pointer' }}
                    />
                    <span>Sync in background (recommended)</span>
                </label>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', marginLeft: '24px' }}>
                    When enabled, the SAML URL opens in a background tab without focus. When disabled, tab with SAML URL will be focused.
                </div>
            </div>
            <button
                onClick={saveOptions}
                style={{
                    padding: '8px 16px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                }}
            >
                Save
            </button>
            {status && <div style={{ marginTop: '10px', color: 'green' }}>{status}</div>}
        </div>
    )
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Options />
    </React.StrictMode>,
)
