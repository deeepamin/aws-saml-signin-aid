import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'

function Options() {
    const [url, setUrl] = useState('')
    const [backgroundSync, setBackgroundSync] = useState(true) // Default to true
    const [autoSync, setAutoSync] = useState(false) // Default to false
    const [tokenExpiryMinutes, setTokenExpiryMinutes] = useState(5) // Default to 5
    const [accountNameRegex, setAccountNameRegex] = useState('')
    const [roleNameRegex, setRoleNameRegex] = useState('')
    const [darkMode, setDarkMode] = useState(false)
    const [status, setStatus] = useState('')

    useEffect(() => {
        // Restore options from chrome.storage
        chrome.storage.sync.get([
            'samlUrl',
            'backgroundSync',
            'tokenExpiryMinutes',
            'autoSync',
            'accountNameRegex',
            'roleNameRegex',
            'darkMode'
        ], (items) => {
            if (items.samlUrl) {
                setUrl(items.samlUrl)
            }
            // Default to true if not set
            setBackgroundSync(items.backgroundSync !== undefined ? items.backgroundSync : true)
            // Default to false if not set
            setAutoSync(items.autoSync !== undefined ? items.autoSync : false)
            // Default to 5 if not set
            setTokenExpiryMinutes(items.tokenExpiryMinutes !== undefined ? items.tokenExpiryMinutes : 5)

            if (items.accountNameRegex) setAccountNameRegex(items.accountNameRegex)
            if (items.roleNameRegex) setRoleNameRegex(items.roleNameRegex)
            if (items.darkMode !== undefined) setDarkMode(items.darkMode)
        })
    }, [])

    const saveOptions = () => {
        chrome.storage.sync.set({
            samlUrl: url,
            backgroundSync: backgroundSync,
            autoSync: autoSync,
            tokenExpiryMinutes: parseInt(tokenExpiryMinutes),
            accountNameRegex: accountNameRegex,
            roleNameRegex: roleNameRegex,
            darkMode: darkMode
        }, () => {
            setStatus('Options saved.')
            setTimeout(() => {
                setStatus('')
            }, 750)
        })
    }

    const theme = {
        bg: darkMode ? '#1f2937' : '#f3f4f6', // gray-800 : gray-100
        cardBg: darkMode ? '#111827' : 'white', // gray-900 : white
        text: darkMode ? '#f9fafb' : '#333', // gray-50
        textSecondary: darkMode ? '#9ca3af' : '#6b7280', // gray-400 : gray-500
        border: darkMode ? '#374151' : '#e5e7eb', // gray-700 : gray-200
        inputBg: darkMode ? '#374151' : 'white', // gray-700 : white
        inputBorder: darkMode ? '#4b5563' : '#d1d5db', // gray-600 : gray-300
        buttonBg: darkMode ? '#374151' : '#f3f4f6', // gray-700 : gray-100
        buttonHover: darkMode ? '#4b5563' : '#e5e7eb', // gray-600 : gray-200
    }

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '40px 20px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            color: theme.text,
            backgroundColor: theme.bg,
            minHeight: '100vh',
            boxSizing: 'border-box'
        }}>
            <div style={{
                backgroundColor: theme.cardBg,
                borderRadius: '8px',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                border: `1px solid ${theme.border}`,
                width: '100%',
                maxWidth: '800px',
                padding: '24px'
            }}>
                {/* Sign-In Options Section */}
                <div style={{ marginBottom: '32px' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: '600', color: theme.text, marginBottom: '16px', borderBottom: `1px solid ${theme.border}`, paddingBottom: '8px' }}>
                        Sign-In Options
                    </h2>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            marginBottom: '8px',
                            color: theme.text
                        }}>
                            AWS SAML Sign-In URL
                        </label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    border: `1px solid ${theme.inputBorder}`,
                                    backgroundColor: theme.inputBg,
                                    color: theme.text,
                                    fontSize: '14px',
                                    boxSizing: 'border-box',
                                    outline: 'none',
                                    transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#2274A5'}
                                onBlur={(e) => e.target.style.borderColor = theme.inputBorder}
                                placeholder="https://example.com/saml"
                            />
                            <button
                                onClick={() => {
                                    if (url) {
                                        chrome.tabs.create({ url: url, active: true })
                                    }
                                }}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: theme.buttonBg,
                                    color: theme.text,
                                    border: `1px solid ${theme.inputBorder}`,
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    whiteSpace: 'nowrap',
                                    transition: 'background-color 0.2s'
                                }}
                                onMouseOver={(e) => e.target.style.backgroundColor = theme.buttonHover}
                                onMouseOut={(e) => e.target.style.backgroundColor = theme.buttonBg}
                                title="Open URL to authenticate"
                            >
                                Authenticate
                            </button>
                        </div>
                        <div style={{ fontSize: '12px', color: theme.textSecondary, marginTop: '6px' }}>
                            URL used for signing in to AWS console via SAML provider (e.g., Azure AD) which issues the SAML token.
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            marginBottom: '8px',
                            color: theme.text
                        }}>
                            Token Expiry Warning (minutes)
                        </label>
                        <input
                            type="number"
                            min="1"
                            value={tokenExpiryMinutes}
                            onChange={(e) => setTokenExpiryMinutes(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: `1px solid ${theme.inputBorder}`,
                                backgroundColor: theme.inputBg,
                                color: theme.text,
                                fontSize: '14px',
                                boxSizing: 'border-box',
                                outline: 'none'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#2274A5'}
                            onBlur={(e) => e.target.style.borderColor = theme.inputBorder}
                        />
                        <div style={{ fontSize: '12px', color: theme.textSecondary, marginTop: '6px' }}>
                            Show expired warning after this many minutes (default: 5).
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={autoSync}
                                onChange={(e) => setAutoSync(e.target.checked)}
                                style={{
                                    marginTop: '3px',
                                    marginRight: '10px',
                                    cursor: 'pointer',
                                    accentColor: '#2274A5'
                                }}
                            />
                            <div>
                                <span style={{ fontSize: '14px', fontWeight: '500', color: theme.text }}>Auto-sync on expiry</span>
                                <div style={{ fontSize: '12px', color: theme.textSecondary, marginTop: '4px' }}>
                                    Automatically refresh the token when it expires. Opens a new invisible window in background and closes it after getting the token.
                                </div>
                            </div>
                        </label>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={backgroundSync}
                                onChange={(e) => setBackgroundSync(e.target.checked)}
                                style={{
                                    marginTop: '3px',
                                    marginRight: '10px',
                                    cursor: 'pointer',
                                    accentColor: '#2274A5'
                                }}
                            />
                            <div>
                                <span style={{ fontSize: '14px', fontWeight: '500', color: theme.text }}>Sync in background</span>
                                <div style={{ fontSize: '12px', color: theme.textSecondary, marginTop: '4px' }}>
                                    When enabled, the SAML URL opens in a background tab without focus. When disabled, tab with SAML URL will be focused.
                                </div>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Display Options Section */}
                <div style={{ marginBottom: '32px' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: '600', color: theme.text, marginBottom: '16px', borderBottom: `1px solid ${theme.border}`, paddingBottom: '8px' }}>
                        Display Options
                    </h2>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            marginBottom: '8px',
                            color: theme.text
                        }}>
                            Theme
                        </label>
                        <div style={{ display: 'flex', gap: '20px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="theme"
                                    checked={!darkMode}
                                    onChange={() => setDarkMode(false)}
                                    style={{
                                        marginRight: '8px',
                                        cursor: 'pointer',
                                        accentColor: '#2274A5'
                                    }}
                                />
                                <span style={{ fontSize: '14px', color: theme.text }}>Light</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="theme"
                                    checked={darkMode}
                                    onChange={() => setDarkMode(true)}
                                    style={{
                                        marginRight: '8px',
                                        cursor: 'pointer',
                                        accentColor: '#2274A5'
                                    }}
                                />
                                <span style={{ fontSize: '14px', color: theme.text }}>Dark</span>
                            </label>
                        </div>
                        <div style={{ fontSize: '12px', color: theme.textSecondary, marginTop: '6px' }}>
                            Choose the appearance of the extension popup and options page.
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            marginBottom: '8px',
                            color: theme.text
                        }}>
                            Clean Account Names (Regex)
                        </label>
                        <input
                            type="text"
                            value={accountNameRegex}
                            onChange={(e) => setAccountNameRegex(e.target.value)}
                            placeholder="e.g. ^AWS-Reserved-SSO_"
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: `1px solid ${theme.inputBorder}`,
                                backgroundColor: theme.inputBg,
                                color: theme.text,
                                fontSize: '14px',
                                boxSizing: 'border-box',
                                outline: 'none'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#2274A5'}
                            onBlur={(e) => e.target.style.borderColor = theme.inputBorder}
                        />
                        <div style={{ fontSize: '12px', color: theme.textSecondary, marginTop: '6px' }}>
                            Regular expression to remove repetitive text from account names. Matches will be replaced with an empty string.
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            marginBottom: '8px',
                            color: theme.text
                        }}>
                            Clean Role Names (Regex)
                        </label>
                        <input
                            type="text"
                            value={roleNameRegex}
                            onChange={(e) => setRoleNameRegex(e.target.value)}
                            placeholder="e.g. -role$"
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: `1px solid ${theme.inputBorder}`,
                                backgroundColor: theme.inputBg,
                                color: theme.text,
                                fontSize: '14px',
                                boxSizing: 'border-box',
                                outline: 'none'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#2274A5'}
                            onBlur={(e) => e.target.style.borderColor = theme.inputBorder}
                        />
                        <div style={{ fontSize: '12px', color: theme.textSecondary, marginTop: '6px' }}>
                            Regular expression to remove repetitive text from role names. Matches will be replaced with an empty string.
                        </div>
                    </div>
                </div>

                <button
                    onClick={saveOptions}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#2274A5',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#1a5c85'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#2274A5'}
                >
                    Save
                </button>

                {status && (
                    <div style={{
                        marginTop: '16px',
                        color: '#059669',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center'
                    }}>
                        <span style={{ marginRight: '6px' }}>✓</span> {status}
                    </div>
                )}
            </div>
        </div>
    )
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Options />
    </React.StrictMode>,
)
