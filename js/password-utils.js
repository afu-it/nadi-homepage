/**
 * Password Hashing Utilities using Web Crypto API
 * 
 * Uses PBKDF2 with SHA-256 for secure password hashing
 * No external dependencies - works in all modern browsers
 */

const PasswordUtils = {
  /**
   * Hash a password using PBKDF2
   * @param {string} password - Plain text password
   * @param {string} salt - Optional salt (generated if not provided)
   * @returns {Promise<string>} Hash in format: "salt:hash"
   */
  async hashPassword(password, salt = null) {
    try {
      // Generate salt if not provided (16 bytes = 128 bits)
      const saltBuffer = salt 
        ? this._base64ToBuffer(salt)
        : crypto.getRandomValues(new Uint8Array(16));
      
      // Convert password to buffer
      const encoder = new TextEncoder();
      const passwordBuffer = encoder.encode(password);
      
      // Import password as key
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );
      
      // Derive key using PBKDF2
      // 100,000 iterations is OWASP recommended minimum for 2024
      const hashBuffer = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltBuffer,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        256 // Output length in bits
      );
      
      // Convert to base64 and return as "salt:hash"
      const saltBase64 = this._bufferToBase64(saltBuffer);
      const hashBase64 = this._bufferToBase64(hashBuffer);
      
      return `${saltBase64}:${hashBase64}`;
    } catch (error) {
      console.error('Password hashing error:', error);
      throw new Error('Failed to hash password');
    }
  },
  
  /**
   * Verify a password against a stored hash
   * @param {string} password - Plain text password to verify
   * @param {string} storedHash - Stored hash in format "salt:hash"
   * @returns {Promise<boolean>} True if password matches
   */
  async verifyPassword(password, storedHash) {
    try {
      // Handle legacy plain text passwords (backward compatibility)
      if (!storedHash.includes(':')) {
        console.warn('⚠️ WARNING: Plain text password detected. Please migrate to hashed passwords.');
        return password === storedHash;
      }
      
      // Split stored hash into salt and hash
      const [saltBase64, expectedHashBase64] = storedHash.split(':');
      
      // Hash the provided password with the same salt
      const computedHash = await this.hashPassword(password, saltBase64);
      const [, computedHashBase64] = computedHash.split(':');
      
      // Constant-time comparison to prevent timing attacks
      return this._constantTimeEqual(computedHashBase64, expectedHashBase64);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  },
  
  /**
   * Constant-time string comparison (prevent timing attacks)
   */
  _constantTimeEqual(a, b) {
    if (a.length !== b.length) return false;
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  },
  
  /**
   * Convert buffer to base64 string
   */
  _bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  },
  
  /**
   * Convert base64 string to buffer
   */
  _base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
};

// Make available globally
window.PasswordUtils = PasswordUtils;
