import React, { useState, useEffect, useMemo, useRef } from 'react'
import ReactDOM from 'react-dom/client'

function Popup() {
    const [accounts, setAccounts] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [samlUrl, setSamlUrl] = useState('')
    const [loading, setLoading] = useState(false)

    const [favorites, setFavorites] = useState([])
    const [lastUpdated, setLastUpdated] = useState(null)

    const searchInputRef = useRef(null)

    const [tokenExpiryMinutes, setTokenExpiryMinutes] = useState(5)
    const [autoSync, setAutoSync] = useState(false)
    const [accountNameRegex, setAccountNameRegex] = useState('')
    const [roleNameRegex, setRoleNameRegex] = useState('')
    const [loadingRole, setLoadingRole] = useState(null) // Track which role is being loaded
    const [refreshingToken, setRefreshingToken] = useState(false) // Track if token is being refreshed

    useEffect(() => {
        // Load accounts and settings
        chrome.storage.sync.get(['samlUrl', 'tokenExpiryMinutes', 'autoSync', 'accountNameRegex', 'roleNameRegex'], (items) => {
            if (items.samlUrl) {
                setSamlUrl(items.samlUrl)
            }
            if (items.tokenExpiryMinutes) {
                setTokenExpiryMinutes(items.tokenExpiryMinutes)
            }
            if (items.autoSync !== undefined) {
                setAutoSync(items.autoSync)
            }
            if (items.accountNameRegex) {
                setAccountNameRegex(items.accountNameRegex)
            }
            if (items.roleNameRegex) {
                setRoleNameRegex(items.roleNameRegex)
            }
        })

        chrome.storage.local.get(['availableRoles', 'favorites', 'scrapingComplete', 'lastUpdated'], (items) => {
            console.log('Initial load - scrapingComplete:', items.scrapingComplete)
            if (items.availableRoles) {
                setAccounts(items.availableRoles)
            }
            if (items.favorites) {
                setFavorites(items.favorites)
            }
            if (items.lastUpdated) {
                setLastUpdated(items.lastUpdated)
            }
            // Only turn off loading if scrapingComplete is explicitly true or undefined (not syncing)
            // If it's false, we're in the middle of syncing
            if (items.scrapingComplete === false) {
                console.log('Scraping in progress, keeping loading state')
                setLoading(true)
            } else {
                setLoading(false)
            }
        })

        // Listen for storage changes to update the list in real-time
        const handleStorageChange = (changes, area) => {
            if (area === 'local') {
                console.log('Storage changed:', changes)

                // Only update accounts if scraping is complete
                if (changes.availableRoles && changes.scrapingComplete?.newValue !== false) {
                    // Check current scrapingComplete state
                    chrome.storage.local.get(['scrapingComplete'], (items) => {
                        console.log('Checking scrapingComplete before updating accounts:', items.scrapingComplete)
                        if (items.scrapingComplete !== false) {
                            setAccounts(changes.availableRoles.newValue)
                        }
                    })
                }
                if (changes.favorites) {
                    setFavorites(changes.favorites.newValue)
                }
                if (changes.lastUpdated) {
                    setLastUpdated(changes.lastUpdated.newValue)
                }
                if (changes.scrapingComplete) {
                    console.log('scrapingComplete changed to:', changes.scrapingComplete.newValue)
                    // When scraping completes, turn off loading and update accounts
                    if (changes.scrapingComplete.newValue === true) {
                        console.log('Scraping complete! Turning off loading')
                        // Clear the safety timeout
                        if (window.syncTimeoutId) {
                            clearTimeout(window.syncTimeoutId)
                            window.syncTimeoutId = null
                        }
                        setLoading(false)
                        // Now it's safe to show accounts
                        chrome.storage.local.get(['availableRoles'], (items) => {
                            if (items.availableRoles) {
                                setAccounts(items.availableRoles)
                            }
                        })
                    } else if (changes.scrapingComplete.newValue === false) {
                        console.log('Scraping started, turning on loading')
                        setLoading(true)
                    }
                }
            }
        }
        chrome.storage.onChanged.addListener(handleStorageChange)
        return () => chrome.storage.onChanged.removeListener(handleStorageChange)
    }, [])

    // Auto-focus search input when popup opens
    useEffect(() => {
        if (searchInputRef.current) {
            searchInputRef.current.focus()
        }
    }, [])

    const handleSync = (showLoadingScreen = true) => {
        if (!samlUrl) {
            chrome.runtime.openOptionsPage()
            return
        }

        if (showLoadingScreen) {
            setLoading(true)
            setAccounts([]) // Clear accounts to show loading state

            // Safety timeout - turn off loading after 30 seconds if something goes wrong
            const timeoutId = setTimeout(() => {
                console.warn('Sync timeout - turning off loading after 30 seconds')
                setLoading(false)
                // Load whatever accounts we have
                chrome.storage.local.get(['availableRoles'], (items) => {
                    if (items.availableRoles) {
                        setAccounts(items.availableRoles)
                    }
                })
            }, 30000)

            // Store timeout ID so we can clear it when scraping completes
            window.syncTimeoutId = timeoutId
        }

        // Check if background sync is enabled
        chrome.storage.sync.get(['backgroundSync'], (items) => {
            const useBackgroundSync = items.backgroundSync !== undefined ? items.backgroundSync : true

            // Always create a tab, but control whether it's active
            chrome.tabs.create({
                url: samlUrl,
                active: !useBackgroundSync // Background sync = inactive tab
            }, (tab) => {
                console.log('Sync tab created:', tab?.id, 'Active:', !useBackgroundSync)
            })
        })
    }

    const handleRoleClick = (role) => {
        // If token is expired, refresh it before proceeding
        if (tokenExpired) {
            // Set refreshing state for this specific role
            setRefreshingToken(true)
            setLoadingRole(role.roleArn)

            // Trigger sync WITHOUT showing the loading screen
            handleSync(false)

            // Wait for sync to complete, then perform login
            let attempts = 0
            const maxAttempts = 30 // 30 seconds max wait

            const checkAndLogin = () => {
                attempts++

                if (attempts > maxAttempts) {
                    console.error('Token refresh timeout')
                    setLoadingRole(null)
                    setRefreshingToken(false)
                    alert('Token refresh timed out. Please try again.')
                    return
                }

                chrome.storage.local.get(['scrapingComplete', 'lastUpdated'], (items) => {
                    console.log('Checking token refresh status:', {
                        scrapingComplete: items.scrapingComplete,
                        lastUpdated: items.lastUpdated,
                        attempt: attempts
                    })

                    if (items.scrapingComplete !== false && items.lastUpdated) {
                        // Check if token is still expired
                        const now = new Date()
                        const updated = new Date(items.lastUpdated)
                        const diffMins = Math.floor((now - updated) / 60000)

                        console.log('Token age:', diffMins, 'minutes, expiry:', tokenExpiryMinutes, 'minutes')

                        if (diffMins < tokenExpiryMinutes) {
                            // Token refreshed, proceed with login
                            console.log('Token refreshed successfully, proceeding with login')
                            performLogin(role)
                        } else {
                            // Still expired, wait a bit more
                            setTimeout(checkAndLogin, 1000)
                        }
                    } else {
                        // Sync still in progress, check again
                        setTimeout(checkAndLogin, 1000)
                    }
                })
            }

            // Start checking after a brief delay
            setTimeout(checkAndLogin, 2000)
            return
        }
        performLogin(role)
    }

    const performLogin = (role) => {
        console.log('Performing login for role:', role.roleArn)
        setLoadingRole(role.roleArn)
        chrome.runtime.sendMessage({ action: 'login', role }, (response) => {
            console.log('Login response:', response)
            setLoadingRole(null)
            setRefreshingToken(false)
            if (response && response.success) {
                // Success
                console.log('Login successful')
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

    const getTimeSinceExpiry = () => {
        if (!lastUpdated) return null
        const now = new Date()
        const updated = new Date(lastUpdated)
        const diffMs = now - updated
        const expiredMs = diffMs - (tokenExpiryMinutes * 60000)
        const diffMins = Math.floor(expiredMs / 60000)

        if (diffMins < 1) return 'just now'
        if (diffMins === 1) return '1 minute ago'
        if (diffMins < 60) return `${diffMins} minutes ago`
        const diffHours = Math.floor(diffMins / 60)
        if (diffHours === 1) return '1 hour ago'
        return `${diffHours} hours ago`
    }

    const minutesSinceSync = lastUpdated ? Math.floor((new Date() - new Date(lastUpdated)) / 60000) : null
    const tokenExpired = minutesSinceSync !== null && minutesSinceSync >= tokenExpiryMinutes

    // Helper functions to clean names using regex
    const cleanAccountName = (name) => {
        if (!name || !accountNameRegex) return name
        try {
            return name.replace(new RegExp(accountNameRegex), '')
        } catch (e) {
            console.error('Invalid account name regex:', e)
            return name
        }
    }

    const cleanRoleName = (name) => {
        if (!name || !roleNameRegex) return name
        try {
            return name.replace(new RegExp(roleNameRegex), '')
        } catch (e) {
            console.error('Invalid role name regex:', e)
            return name
        }
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#999"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                            position: 'absolute',
                            left: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            pointerEvents: 'none'
                        }}
                    >
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            padding: '6px 8px 6px 24px',
                            borderRadius: '4px',
                            border: '1px solid #ccc',
                            width: '100%',
                            fontSize: '13px',
                            boxSizing: 'border-box',
                            textAlign: 'left'
                        }}
                    />
                </div>
                <button
                    onClick={handleSync}
                    disabled={loading}
                    title="Sync Accounts"
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        color: '#2274A5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: loading ? 0.5 : 1
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 4v6h-6"></path>
                        <path d="M1 20v-6h6"></path>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                </button>
            </div>


            <hr style={{ border: 'none', borderBottom: '1px solid #999', margin: '8px 0 8px 0', width: '100%' }} />

            {/* Token expiry warning */}
            {tokenExpired && accounts.length > 0 && (
                <div style={{
                    padding: '8px 12px',
                    backgroundColor: '#ffebee',
                    border: '1px solid #ef5350',
                    borderRadius: '4px',
                    margin: '0 0 8px 0',
                    fontSize: '12px',
                    color: '#c62828'
                }}>
                    ⏰ Token expired ({getTimeSinceExpiry()}), please re-sync.
                </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto' }}>
                {loading && accounts.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: '40px' }}>
                        <div style={{
                            border: '3px solid #f3f3f3',
                            borderTop: '3px solid #2274A5',
                            borderRadius: '50%',
                            width: '40px',
                            height: '40px',
                            animation: 'spin 1s linear infinite'
                        }}></div>
                        <div style={{ marginTop: '16px', color: '#666', fontSize: '14px' }}>Loading accounts...</div>
                        <style>{`
                            @keyframes spin {
                                0% { transform: rotate(0deg); }
                                100% { transform: rotate(360deg); }
                            }
                        `}</style>
                    </div>
                ) : filteredGroups.length === 0 ? (
                    <div style={{ color: '#666', textAlign: 'center', marginTop: '20px' }}>
                        {accounts.length === 0 ? (
                            !samlUrl ? (
                                <div>
                                    <div style={{ marginBottom: '8px' }}>No AWS SAML Sign-In URL configured.</div>
                                    <a
                                        href="#"
                                        onClick={(e) => {
                                            e.preventDefault()
                                            chrome.runtime.openOptionsPage()
                                        }}
                                        style={{ color: '#2274A5', textDecoration: 'none', fontWeight: '500' }}
                                    >
                                        Configure AWS SAML Sign-In URL
                                    </a>
                                </div>
                            ) : (
                                'No accounts found. Click Sync to load.'
                            )
                        ) : (
                            'No matches found.'
                        )}
                    </div>
                ) : (
                    <div>
                        {filteredGroups.map(group => {
                            const isFavorite = favorites.includes(group.accountId)
                            return (
                                <div key={group.accountId} style={{ marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
                                    <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'baseline' }}>
                                            {group.accountName && group.accountName !== 'Unknown Account' ? (
                                                <>
                                                    <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#333' }}>
                                                        {cleanAccountName(group.accountName)}
                                                    </span>
                                                    <span style={{ color: '#888', fontSize: '12px', marginLeft: '8px', fontWeight: 'bold' }}>
                                                        ({group.accountId})
                                                    </span>
                                                </>
                                            ) : (
                                                <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#333' }}>
                                                    {group.accountId}
                                                </span>
                                            )}
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
                                        {group.roles.map(role => {
                                            const isLoadingThisRole = loadingRole === role.roleArn;
                                            const isDisabled = refreshingToken && !isLoadingThisRole;
                                            return (
                                                <button
                                                    key={role.roleArn}
                                                    onClick={() => handleRoleClick(role)}
                                                    disabled={isDisabled || isLoadingThisRole}
                                                    title={role.roleArn}
                                                    style={{
                                                        padding: '4px 10px',
                                                        borderRadius: '12px',
                                                        border: '1px solid #ddd',
                                                        backgroundColor: isDisabled ? '#e0e0e0' : '#f5f5f5',
                                                        cursor: (isDisabled || isLoadingThisRole) ? 'not-allowed' : 'pointer',
                                                        fontSize: '12px',
                                                        color: '#333',
                                                        transition: 'background-color 0.2s',
                                                        opacity: isDisabled ? 0.5 : 1
                                                    }}
                                                    onMouseEnter={(e) => !(isDisabled || isLoadingThisRole) && (e.currentTarget.style.backgroundColor = '#e0e0e0')}
                                                    onMouseLeave={(e) => !(isDisabled || isLoadingThisRole) && (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                                                >
                                                    {isLoadingThisRole ? '⟳ ' : ''}{cleanRoleName(role.roleName)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
            {accounts.length > 0 && (
                <div style={{ marginTop: '10px', fontSize: '10px', color: '#999', textAlign: 'center' }}>
                    {groupedAccounts.length} accounts available
                </div>
            )}
        </div>
    )
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Popup />
    </React.StrictMode>,
)
