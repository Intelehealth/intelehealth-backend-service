const crypto = require('crypto');

/**
 * Normalizes a public key to PEM format
 * @param {string} publicKey - Public key in various formats
 * @returns {string} PEM formatted public key
 */
function normalizePublicKey(publicKey) {
    if (!publicKey || typeof publicKey !== 'string') {
        throw new Error('Public key must be a non-empty string');
    }

    // Remove any existing whitespace
    let trimmedKey = publicKey.trim();

    // If already in PEM format, ensure proper line breaks
    if (trimmedKey.includes('-----BEGIN')) {
        // Normalize line breaks and ensure proper formatting
        trimmedKey = trimmedKey.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        // Ensure there's a newline before END
        if (!trimmedKey.includes('\n-----END')) {
            trimmedKey = trimmedKey.replace('-----END', '\n-----END');
        }
        return trimmedKey;
    }

    // If it's base64 without headers, add PEM headers
    // Check if it looks like base64 (alphanumeric, +, /, =)
    const cleanKey = trimmedKey.replace(/\s/g, '');
    const base64Pattern = /^[A-Za-z0-9+/=]+$/;
    
    if (base64Pattern.test(cleanKey) && cleanKey.length > 50) {
        // Split into 64 character lines for proper PEM formatting
        const keyLines = cleanKey.match(/.{1,64}/g) || [];
        return `-----BEGIN PUBLIC KEY-----\n${keyLines.join('\n')}\n-----END PUBLIC KEY-----`;
    }

    // If we can't determine the format, try to use it as is
    // This might fail, but we'll let crypto provide a better error message
    return trimmedKey;
}

/**
 * Encrypts data using RSA public key with OAEP padding (SHA-1)
 * Algorithm: RSA/ECB/OAEPWithSHA-1AndMGF1Padding
 * 
 * @param {string} publicKey - PEM formatted public key
 * @param {string} data - Data to encrypt
 * @param {string} algorithm - Encryption algorithm
 * @returns {string} Base64 encoded encrypted data
 */
function encryptWithPublicKey(publicKey, data, algorithm = 'RSA/ECB/OAEPWithSHA-1AndMGF1Padding') {
    try {
        if (!publicKey || !data) {
            throw new Error('Public key and data are required');
        }

        // Normalize the public key to ensure proper PEM format
        const normalizedKey = normalizePublicKey(publicKey);

        let padding = crypto.constants.RSA_PKCS1_OAEP_PADDING;
        let oaepHash = 'sha1';
        if(algorithm === 'RSA/ECB/OAEPWithSHA-256AndMGF1Padding') {
            padding = crypto.constants.RSA_PKCS1_OAEP_PADDING;
            oaepHash = 'sha256';
        }

        // Validate the key format by trying to create a key object
        try {
            // This will throw if the key format is invalid
            crypto.createPublicKey(normalizedKey);
        } catch (keyError) {
            throw new Error(`Invalid public key format: ${keyError.message}. Please ensure the key is in PEM format.`);
        }

        const encryptedData = crypto.publicEncrypt(
            { 
                key: normalizedKey, 
                padding, 
                oaepHash 
            }, 
            Buffer.from(data, 'utf8')
        ).toString('base64');
        
        return encryptedData;
    } catch (error) {
        // Provide more context in error message
        if (error.message.includes('DECODER routines') || error.message.includes('unsupported')) {
            throw new Error(`Encryption failed: Invalid key format. The public key may not be in the correct PEM format. Original error: ${error.message}`);
        }
        throw new Error(`Encryption failed: ${error.message}`);
    }
}

/**
 * Decrypts data using RSA private key with OAEP padding (SHA-1)
 * 
 * @param {string} privateKey - PEM formatted private key
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @returns {string} Decrypted data
 */
function decryptWithPrivateKey(privateKey, encryptedData) {
    try {
        const decrypted = crypto.privateDecrypt(
            {
                key: privateKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha1',
            },
            Buffer.from(encryptedData, 'base64')
        );
        
        return decrypted.toString('utf8');
    } catch (error) {
        throw new Error(`Decryption failed: ${error.message}`);
    }
}

module.exports = {
    encryptWithPublicKey,
    decryptWithPrivateKey
};
