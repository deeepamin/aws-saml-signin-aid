import { parseSAMLResponse } from '../utils/saml.js'

console.log('AWS SAML Sign-In Aid: Background script loaded')

chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (details.method === 'POST') {
            console.log('Captured POST request:', details.url)
            console.log('Request Body Keys:', details.requestBody ? Object.keys(details.requestBody) : 'None')

            let samlResponse = null

            if (details.requestBody) {
                if (details.requestBody.formData && details.requestBody.formData.SAMLResponse) {
                    console.log('Found SAMLResponse in formData')
                    samlResponse = details.requestBody.formData.SAMLResponse[0]
                } else if (details.requestBody.raw) {
                    console.log('Found raw body, attempting to parse')
                    // Try to parse raw body if formData is missing
                    try {
                        const rawData = details.requestBody.raw[0].bytes
                        const decoder = new TextDecoder('utf-8')
                        const text = decoder.decode(rawData)
                        console.log('Raw body text prefix:', text.substring(0, 100))
                        // Simple check for SAMLResponse=...
                        const match = text.match(/SAMLResponse=([^&]+)/)
                        if (match) {
                            console.log('Found SAMLResponse in raw body regex match')
                            samlResponse = decodeURIComponent(match[1])
                        } else {
                            console.log('No SAMLResponse= pattern found in raw body')
                        }
                    } catch (e) {
                        console.error('Error parsing raw body', e)
                    }
                } else {
                    console.log('No formData or raw body found')
                }
            }

            if (samlResponse) {
                console.log('SAML Response found, length:', samlResponse.length)

                const { roles } = parseSAMLResponseRegex(samlResponse)
                console.log('Parsed roles:', roles)

                chrome.storage.local.set({
                    samlResponse: samlResponse,
                    availableRoles: roles,
                    lastUpdated: new Date().toISOString(),
                    pendingAuthTabId: details.tabId, // Store tab ID for scraping
                    scrapingComplete: false // Mark that we're waiting for account names
                }, () => {
                    console.log('SAML Roles saved to storage. Waiting for page load to scrape names...')
                })
            } else {
                console.log('No SAMLResponse found in request body')
            }
        }
    },
    { urls: ['*://*.signin.aws.amazon.com/*'] },
    ['requestBody']
)

// Listener for page load to scrape account names
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        chrome.storage.local.get(['pendingAuthTabId'], (result) => {
            if (result.pendingAuthTabId === tabId) {
                console.log('Auth tab loaded, waiting 2s then injecting scraper...')

                // Wait a bit for any client-side rendering
                setTimeout(() => {
                    chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        func: scrapeAccountNames
                    }).then(() => {
                        console.log('Scraper injected')
                    }).catch(err => {
                        console.error('Failed to inject scraper', err)
                    })
                }, 2000)
            }
        })
    }
})

// Content script function to be injected
function scrapeAccountNames() {
    // Helper to clean up account name
    const cleanName = (name) => {
        return name.replace(/^Account:\s*/i, '').trim()
    }

    try {
        const accounts = []
        const debugLogs = []

        debugLogs.push('Scraper started')
        debugLogs.push('URL: ' + window.location.href)

        // Strategy 1: Standard .saml-account-name
        const accountNameElements = document.querySelectorAll('.saml-account-name')
        debugLogs.push(`Found ${accountNameElements.length} .saml-account-name elements`)

        if (accountNameElements.length > 0) {
            accountNameElements.forEach(el => {
                const text = el.innerText
                debugLogs.push(`Element text: ${text}`)
                const match = text.match(/(.*)\((\d{12})\)/)
                if (match) {
                    accounts.push({
                        name: cleanName(match[1]),
                        id: match[2]
                    })
                }
            })
        }

        // Strategy 2: Look for saml-account class
        if (accounts.length === 0) {
            const samlAccounts = document.querySelectorAll('.saml-account')
            debugLogs.push(`Found ${samlAccounts.length} .saml-account elements`)
            samlAccounts.forEach(el => {
                debugLogs.push(`Account row text: ${el.innerText}`)
            })
        }

        // Strategy 3: Search for any element with an account ID pattern
        if (accounts.length === 0) {
            debugLogs.push('Strategy 3: Walking DOM for IDs')
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
            let node;
            while (node = walker.nextNode()) {
                if (/\d{12}/.test(node.nodeValue)) {
                    debugLogs.push(`Found ID in text node: "${node.nodeValue.trim()}" Parent: ${node.parentElement.tagName}.${node.parentElement.className}`)
                }
            }
        }

        // Strategy 4: Brute force regex on body text
        if (accounts.length === 0) {
            debugLogs.push('Strategy 4: Brute force regex on body text')
            const bodyText = document.body.innerText
            // Look for lines like "Account Name (123456789012)"
            const regex = /([^\n]+)\s\((\d{12})\)/g
            let match;
            while ((match = regex.exec(bodyText)) !== null) {
                let name = cleanName(match[1])
                const id = match[2]

                // Filter out likely false positives (too long, or "Account: (123...)")
                if (name.length < 100 && name.length > 0) {
                    debugLogs.push(`Found match in body text: ${name} (${id})`)
                    accounts.push({ name, id })
                }
            }
        }

        chrome.runtime.sendMessage({
            action: 'updateAccountNames',
            accounts: accounts,
            debug: debugLogs
        })

    } catch (e) {
        console.error('Scraping failed', e)
        chrome.runtime.sendMessage({ action: 'updateAccountNames', accounts: [], error: e.message })
    }
}

// Handle scraped names
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateAccountNames') {
        console.log('Received account names:', request.accounts)
        if (request.debug) {
            console.log('Scraper Debug Logs:', request.debug.join('\n'))
        }
        if (request.error) {
            console.error('Scraper Error:', request.error)
        }

        chrome.storage.local.get(['availableRoles', 'pendingAuthTabId'], (result) => {
            const roles = result.availableRoles || []
            const pendingTabId = result.pendingAuthTabId

            // Update roles with names
            const updatedRoles = roles.map(role => {
                const foundAccount = request.accounts.find(acc => acc.id === role.accountId)
                if (foundAccount) {
                    return {
                        ...role,
                        accountName: foundAccount.name,
                        display: `${foundAccount.name} (${role.accountId}) - ${role.roleName}`
                    }
                }
                return role
            })

            chrome.storage.local.set({
                availableRoles: updatedRoles,
                pendingAuthTabId: null, // Clear pending tab
                scrapingComplete: true // Mark scraping as complete
            }, () => {
                console.log('Roles updated with account names')
                // Now close the tab
                if (sender.tab && sender.tab.id) {
                    chrome.tabs.remove(sender.tab.id)
                } else if (pendingTabId) {
                    chrome.tabs.remove(pendingTabId)
                }
            })
        })
    }
})

// Message listener for sign-in requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'login') {
        handleLogin(request.role, sendResponse)
        return true // Keep channel open for async response
    }
})

async function handleLogin(role, sendResponse) {
    try {
        const { samlResponse } = await chrome.storage.local.get('samlResponse')
        if (!samlResponse) {
            sendResponse({ success: false, error: 'No SAML Response found' })
            return
        }

        // 1. AssumeRoleWithSAML
        const stsParams = new URLSearchParams({
            Version: '2011-06-15',
            Action: 'AssumeRoleWithSAML',
            DurationSeconds: '3600',
            RoleArn: role.roleArn,
            PrincipalArn: role.principalArn,
            SAMLAssertion: samlResponse
        })

        const stsResp = await fetch('https://sts.amazonaws.com/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: stsParams.toString()
        })

        const stsText = await stsResp.text()

        if (!stsResp.ok) {
            throw new Error(`STS Error: ${stsText}`)
        }

        // Parse STS XML response to get credentials
        // Note: DOMParser is not available in SW, using regex again
        const accessKeyId = stsText.match(/<AccessKeyId>(.*?)<\/AccessKeyId>/)?.[1]
        const secretAccessKey = stsText.match(/<SecretAccessKey>(.*?)<\/SecretAccessKey>/)?.[1]
        const sessionToken = stsText.match(/<SessionToken>(.*?)<\/SessionToken>/)?.[1]

        if (!accessKeyId || !secretAccessKey || !sessionToken) {
            throw new Error('Failed to parse credentials from STS response')
        }

        // 2. Get Signin Token from Federation
        const sessionJson = JSON.stringify({
            sessionId: accessKeyId,
            sessionKey: secretAccessKey,
            sessionToken: sessionToken
        })

        const fedUrl = `https://signin.aws.amazon.com/federation?Action=getSigninToken&Session=${encodeURIComponent(sessionJson)}`
        const fedResp = await fetch(fedUrl)
        const fedJson = await fedResp.json()

        if (!fedJson.SigninToken) {
            throw new Error('Failed to get SigninToken')
        }

        // 3. Generate Login URL
        const loginUrl = `https://signin.aws.amazon.com/federation?Action=login&Issuer=aws-saml-signin-aid&Destination=${encodeURIComponent('https://console.aws.amazon.com/')}&SigninToken=${encodeURIComponent(fedJson.SigninToken)}`

        // 4. Open in new tab
        chrome.tabs.create({ url: loginUrl })
        sendResponse({ success: true })

    } catch (e) {
        console.error('Login failed', e)
        sendResponse({ success: false, error: e.message })
    }
}

// Simple Regex based parser for Service Worker environment
function parseSAMLResponseRegex(samlResponse) {
    try {
        const decoded = atob(samlResponse)
        const roles = []
        // Look for Attribute Name="https://aws.amazon.com/SAML/Attributes/Role"
        // Then find AttributeValue inside it.

        // This is a bit brittle with Regex, but DOMParser is not in SW.
        // A robust way is to use 'xml-js' or similar, but we want to avoid adding heavy deps if possible.
        // Let's try to find all AttributeValue tags that look like AWS roles.

        // Look for Attribute Name="https://aws.amazon.com/SAML/Attributes/Role"
        // Then find AttributeValue inside it.
        // The regex needs to be robust enough to capture the value between <AttributeValue> tags
        // It usually looks like <saml2:AttributeValue>arn:aws:iam::...</saml2:AttributeValue> or similar

        // Let's try a two-step approach: find the Role attribute, then extract values.
        // Or just search for the ARN pattern which is very specific.

        // Regex to capture Role ARN and Principal ARN
        // Role ARN format: arn:aws:iam::account-id:role/role-name-with-path
        // Principal ARN format: arn:aws:iam::account-id:saml-provider/provider-name
        // We need to allow '/' in the role name path.

        const roleRegex = /arn:aws:iam::\d+:role\/[\w+=,.@\/-]+,arn:aws:iam::\d+:saml-provider\/[\w+=,.@\/-]+/g
        let match;
        while ((match = roleRegex.exec(decoded)) !== null) {
            const value = match[0]
            const parts = value.split(',')
            const roleArn = parts.find((p) => p.includes(':role/'))
            const principalArn = parts.find((p) => p.includes(':saml-provider/'))

            if (roleArn && principalArn) {
                const roleArnParts = roleArn.split(':')
                const accountId = roleArnParts[4]
                const roleName = roleArnParts[5].replace('role/', '')

                // Avoid duplicates
                if (!roles.find(r => r.roleArn === roleArn)) {
                    roles.push({
                        roleArn,
                        principalArn,
                        accountId,
                        roleName,
                        display: `${accountId} (${roleName})`
                    })
                }
            }
        }

        return { roles }
    } catch (e) {
        console.error('Error parsing SAML in background', e)
        return { roles: [] }
    }
}


// Setup alarm for auto-sync
chrome.alarms.create('checkTokenExpiry', { periodInMinutes: 1 })

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkTokenExpiry') {
        checkAndSyncToken()
    }
})

function checkAndSyncToken() {
    chrome.storage.sync.get(['autoSync', 'tokenExpiryMinutes', 'samlUrl'], (syncItems) => {
        if (!syncItems.autoSync || !syncItems.samlUrl) {
            return
        }

        chrome.storage.local.get(['lastUpdated', 'scrapingComplete'], (localItems) => {
            // Don't sync if scraping is currently in progress
            if (localItems.scrapingComplete === false) {
                return
            }

            const lastUpdated = localItems.lastUpdated ? new Date(localItems.lastUpdated) : null
            if (!lastUpdated) {
                return
            }

            const now = new Date()
            const diffMs = now - lastUpdated
            const diffMins = Math.floor(diffMs / 60000)
            const expiryMinutes = syncItems.tokenExpiryMinutes || 5

            if (diffMins >= expiryMinutes) {
                console.log(`Token expired (${diffMins} mins ago). Auto-syncing...`)

                // Perform sync in a minimized window to be less intrusive
                chrome.windows.create({
                    url: syncItems.samlUrl,
                    focused: false,
                    width: 1,
                    height: 1,
                    left: 10000,
                    top: 10000
                }, (window) => {
                    console.log('Auto-sync window created:', window?.id)
                })
            }
        })
    })
}
