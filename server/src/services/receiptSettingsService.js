const fs = require('fs/promises');
const path = require('path');

const RECEIPT_SETTINGS_FILE = path.join(__dirname, '../../data/receipt_settings.json');

const DEFAULT_RECEIPT_SETTINGS = {
    invoiceTitle: 'SALES INVOICE',
    businessName: 'FitOS Gym',
    branchAddress: '123 Fitness Blvd, Gym City',
    tin: '',
    vatType: 'VAT',
    vatRate: '12',
    permitToUseNo: '',
    birAccreditationNo: '',
    minNo: '',
    serialNo: '',
    vatRegTin: '',
    systemDetails: '',
    mandatoryDisclaimer: 'THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX',
    footerDisclaimer: 'THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX',
    printerName: '',
    printerTin: '',
    issuedDateLabel: 'Date & Time Issued',
    thankYouMessage: 'Thank you for training with us!'
};

const asCleanString = (value) => String(value ?? '').trim();

const sanitizeReceiptSettings = (input = {}) => ({
    invoiceTitle: asCleanString(input.invoiceTitle || DEFAULT_RECEIPT_SETTINGS.invoiceTitle),
    businessName: asCleanString(input.businessName || DEFAULT_RECEIPT_SETTINGS.businessName),
    branchAddress: asCleanString(input.branchAddress || DEFAULT_RECEIPT_SETTINGS.branchAddress),
    tin: asCleanString(input.tin),
    vatType: asCleanString(input.vatType || DEFAULT_RECEIPT_SETTINGS.vatType).toUpperCase() === 'NON-VAT' ? 'NON-VAT' : 'VAT',
    vatRate: asCleanString(input.vatRate || DEFAULT_RECEIPT_SETTINGS.vatRate),
    permitToUseNo: asCleanString(input.permitToUseNo),
    birAccreditationNo: asCleanString(input.birAccreditationNo),
    minNo: asCleanString(input.minNo),
    serialNo: asCleanString(input.serialNo),
    vatRegTin: asCleanString(input.vatRegTin),
    systemDetails: asCleanString(input.systemDetails),
    mandatoryDisclaimer: asCleanString(input.mandatoryDisclaimer || input.footerDisclaimer || DEFAULT_RECEIPT_SETTINGS.mandatoryDisclaimer),
    footerDisclaimer: asCleanString(input.footerDisclaimer || input.mandatoryDisclaimer || DEFAULT_RECEIPT_SETTINGS.footerDisclaimer),
    printerName: asCleanString(input.printerName),
    printerTin: asCleanString(input.printerTin),
    issuedDateLabel: asCleanString(input.issuedDateLabel || DEFAULT_RECEIPT_SETTINGS.issuedDateLabel),
    thankYouMessage: asCleanString(input.thankYouMessage || DEFAULT_RECEIPT_SETTINGS.thankYouMessage)
});

const mergeWithDefaults = (value) => sanitizeReceiptSettings({
    ...DEFAULT_RECEIPT_SETTINGS,
    ...(value || {})
});

async function getReceiptSettings() {
    try {
        const raw = await fs.readFile(RECEIPT_SETTINGS_FILE, 'utf8');
        return mergeWithDefaults(JSON.parse(raw));
    } catch (error) {
        if (error.code === 'ENOENT') {
            const defaults = mergeWithDefaults();
            await saveReceiptSettings(defaults);
            return defaults;
        }
        throw error;
    }
}

async function saveReceiptSettings(settings) {
    const merged = mergeWithDefaults(settings);
    await fs.mkdir(path.dirname(RECEIPT_SETTINGS_FILE), { recursive: true });
    await fs.writeFile(RECEIPT_SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
}

module.exports = {
    DEFAULT_RECEIPT_SETTINGS,
    getReceiptSettings,
    saveReceiptSettings
};
