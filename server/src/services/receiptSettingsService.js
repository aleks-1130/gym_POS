const prisma = require('../config/prisma');

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
    const record = await prisma.receiptSettings.findUnique({
        where: { id: 1 }
    });
    if (!record) {
        const defaults = mergeWithDefaults();
        await prisma.receiptSettings.create({
            data: {
                id: 1,
                settings: defaults
            }
        });
        return defaults;
    }
    return mergeWithDefaults(record.settings || {});
}

async function saveReceiptSettings(settings) {
    const merged = mergeWithDefaults(settings);
    await prisma.receiptSettings.upsert({
        where: { id: 1 },
        create: {
            id: 1,
            settings: merged
        },
        update: {
            settings: merged
        }
    });
    return merged;
}

module.exports = {
    DEFAULT_RECEIPT_SETTINGS,
    getReceiptSettings,
    saveReceiptSettings
};
