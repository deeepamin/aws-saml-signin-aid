import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'

function Options() {
    const [url, setUrl] = useState('')
    const [status, setStatus] = useState('')

    useEffect(() => {
        // Restore options from chrome.storage
        chrome.storage.sync.get(['samlUrl'], (items) => {
            if (items.samlUrl) {
                setUrl(items.samlUrl)
            }
        })
    }, [])

    const saveOptions = () => {
        chrome.storage.sync.set({ samlUrl: url }, () => {
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
