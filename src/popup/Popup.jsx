import React, { useState, useEffect, useMemo } from 'react'
import ReactDOM from 'react-dom/client'

function Popup() {
    const [accounts, setAccounts] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [samlUrl, setSamlUrl] = useState('')
    const [loading, setLoading] = useState(false)

    const [favorites, setFavorites] = useState([])

    useEffect(() => {
        // Load accounts and settings
        chrome.storage.sync.get(['samlUrl'], (items) => {
            if (items.samlUrl) {
                setSamlUrl(items.samlUrl)
            }
        })

        chrome.storage.local.get(['availableRoles', 'favorites'], (items) => {
            if (items.availableRoles) {
                setAccounts(items.availableRoles)
            }
            if (items.favorites) {
                setFavorites(items.favorites)
            }
        })

        // Listen for storage changes to update the list in real-time
        const handleStorageChange = (changes, area) => {
            if (area === 'local') {
                if (changes.availableRoles) {
                    setAccounts(changes.availableRoles.newValue)
                }
                if (changes.favorites) {
                    setFavorites(changes.favorites.newValue)
                }
            }
        }
        chrome.storage.onChanged.addListener(handleStorageChange)
        return () => chrome.storage.onChanged.removeListener(handleStorageChange)
    }, [])

    const handleSync = () => {
        if (!samlUrl) {
            chrome.runtime.openOptionsPage()
            return
        }
        setLoading(true)
        chrome.tabs.create({ url: samlUrl }, (tab) => {
            // Tab opened
        })
    }

    const handleRoleClick = (role) => {
        setLoading(true)
        chrome.runtime.sendMessage({ action: 'login', role }, (response) => {
            setLoading(false)
            if (response && response.success) {
                // Success
            } else {
                console.error('Login failed', response?.error)
                alert('Login failed: ' + (response?.error || 'Unknown error'))
            }
        })
    }

    const handleToggleFavorite = (accountId) => {
        const newFavorites = favorites.includes(accountId)
            ? favorites.filter(id => id !== accountId)
            : [...favorites, accountId]

        setFavorites(newFavorites)
        chrome.storage.local.set({ favorites: newFavorites })
    }

    // Group accounts by Account ID
    const groupedAccounts = useMemo(() => {
        const groups = {}
        accounts.forEach(role => {
            if (!groups[role.accountId]) {
                groups[role.accountId] = {
                    accountId: role.accountId,
                    accountName: role.accountName,
                    roles: []
                }
            }
            // Update account name if we find a better one (e.g. scraped one)
            if (role.accountName && !groups[role.accountId].accountName) {
                groups[role.accountId].accountName = role.accountName
            }
            groups[role.accountId].roles.push(role)
        })

        // Sort: Favorites first, then alphabetical by name
        return Object.values(groups).sort((a, b) => {
            const aFav = favorites.includes(a.accountId)
            const bFav = favorites.includes(b.accountId)
            if (aFav && !bFav) return -1
            if (!aFav && bFav) return 1

            const nameA = (a.accountName || a.accountId).toLowerCase()
            const nameB = (b.accountName || b.accountId).toLowerCase()
            return nameA.localeCompare(nameB)
        })
    }, [accounts, favorites])

    // Filter groups based on search query
    const filteredGroups = groupedAccounts.filter(group => {
        const query = searchQuery.toLowerCase()
        const accountMatch = (group.accountName && group.accountName.toLowerCase().includes(query)) ||
            group.accountId.includes(query)

        if (accountMatch) return true

        // If account doesn't match, check if any role matches
        return group.roles.some(role => role.roleName.toLowerCase().includes(query))
    })

    return (
        <div style={{ padding: '16px', minHeight: '300px', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>AWS SAML Sign-In Aid</h2>
                <button
                    onClick={handleSync}
                    disabled={loading}
                    style={{
                        padding: '6px 12px',
                        backgroundColor: '#2274A5',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500'
                    }}
                >
                    {loading ? 'Syncing...' : 'Sync'}
                </button>
            </div>

            <input
                type="text"
                placeholder="Search accounts or roles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                    padding: '8px',
                    marginBottom: '16px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    width: '100%',
                    boxSizing: 'border-box',
                    fontSize: '14px'
                }}
            />

            <div style={{ flex: 1, overflowY: 'auto' }}>
                {filteredGroups.length === 0 ? (
                    <div style={{ color: '#666', textAlign: 'center', marginTop: '20px' }}>
                        {accounts.length === 0 ? 'No accounts found. Click Sync to load.' : 'No matches found.'}
                    </div>
                ) : (
                    <div>
                        {filteredGroups.map(group => {
                            const isFavorite = favorites.includes(group.accountId)
                            return (
                                <div key={group.accountId} style={{ marginBottom: '16px', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
                                    <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'baseline' }}>
                                            <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#333' }}>
                                                {group.accountName || 'Unknown Account'}
                                            </span>
                                            <span style={{ color: '#888', fontSize: '12px', marginLeft: '8px', fontWeight: 'bold' }}>
                                                ({group.accountId})
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleToggleFavorite(group.accountId)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: '4px',
                                                color: isFavorite ? '#FFD700' : '#ccc',
                                                fontSize: '18px',
                                                lineHeight: 1,
                                                marginTop: '4px'
                                            }}
                                            title={isFavorite ? "Unfavorite" : "Favorite"}
                                        >
                                            ★
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {group.roles.map(role => (
                                            <button
                                                key={role.roleArn}
                                                onClick={() => handleRoleClick(role)}
                                                title={role.roleArn}
                                                style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '12px',
                                                    border: '1px solid #ddd',
                                                    backgroundColor: '#f5f5f5',
                                                    cursor: 'pointer',
                                                    fontSize: '12px',
                                                    color: '#333',
                                                    transition: 'background-color 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                                            >
                                                {role.roleName}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
            <div style={{ marginTop: '10px', fontSize: '10px', color: '#999', textAlign: 'center' }}>
                {accounts.length} roles available
            </div>
        </div>
    )
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Popup />
    </React.StrictMode>,
)
