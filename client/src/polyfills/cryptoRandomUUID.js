const toHex = (value) => value.toString(16).padStart(2, '0');

const fallbackRandomUUID = () => {
    const bytes = new Uint8Array(16);

    if (typeof globalThis.crypto?.getRandomValues === 'function') {
        globalThis.crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < bytes.length; i += 1) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
    }

    // RFC 4122 version 4 (random)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, toHex);
    return [
        hex.slice(0, 4).join(''),
        hex.slice(4, 6).join(''),
        hex.slice(6, 8).join(''),
        hex.slice(8, 10).join(''),
        hex.slice(10, 16).join('')
    ].join('-');
};

(() => {
    try {
        const cryptoObj = globalThis.crypto;
        if (cryptoObj && typeof cryptoObj.randomUUID !== 'function') {
            cryptoObj.randomUUID = fallbackRandomUUID;
        }
    } catch (error) {
        // Keep startup resilient on restricted browsers.
        console.warn('Unable to polyfill crypto.randomUUID:', error);
    }
})();

