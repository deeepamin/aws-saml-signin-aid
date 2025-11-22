export const parseSAMLResponse = (samlResponse) => {
    try {
        const decoded = atob(samlResponse)
        const parser = new DOMParser()
        const xmlDoc = parser.parseFromString(decoded, 'text/xml')

        const roles = []
        const attributes = xmlDoc.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'Attribute')

        for (let i = 0; i < attributes.length; i++) {
            const attribute = attributes[i]
            if (attribute.getAttribute('Name') === 'https://aws.amazon.com/SAML/Attributes/Role') {
                const values = attribute.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'AttributeValue')
                for (let j = 0; j < values.length; j++) {
                    const value = values[j].textContent
                    // Value format: arn:aws:iam::123456789012:role/RoleName,arn:aws:iam::123456789012:saml-provider/ProviderName
                    const parts = value.split(',')
                    const roleArn = parts.find((p) => p.includes(':role/'))
                    const principalArn = parts.find((p) => p.includes(':saml-provider/'))

                    if (roleArn && principalArn) {
                        // Extract account ID and role name
                        const roleArnParts = roleArn.split(':')
                        const accountId = roleArnParts[4]
                        const roleName = roleArnParts[5].replace('role/', '')

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
        }
        return roles
    } catch (e) {
        console.error('Error parsing SAML response', e)
        return []
    }
}
