import React from 'react';
import { useCurrency } from '../context/CurrencyContext';

// This component can be used in a modal or hidden iframe for printing
export const Receipt = React.forwardRef(({ transaction, items, member, cashierName, discount = 0, paymentDetails, receiptSettings }, ref) => {
    const { formatPrice } = useCurrency();
    const transactionDate = transaction?.date ? new Date(transaction.date) : new Date();

    const settings = {
        invoiceTitle: receiptSettings?.invoiceTitle || 'SALES INVOICE',
        businessName: receiptSettings?.businessName || 'FitOS Gym',
        branchAddress: receiptSettings?.branchAddress || '123 Fitness Blvd, Gym City',
        tin: receiptSettings?.tin || '',
        vatType: String(receiptSettings?.vatType || 'VAT').toUpperCase() === 'NON-VAT' ? 'NON-VAT' : 'VAT',
        vatRate: Number.parseFloat(receiptSettings?.vatRate || '12'),
        vatRegTin: receiptSettings?.vatRegTin || '',
        issuedDateLabel: receiptSettings?.issuedDateLabel || 'Date & Time Issued',
        permitToUseNo: receiptSettings?.permitToUseNo || '',
        birAccreditationNo: receiptSettings?.birAccreditationNo || '',
        minNo: receiptSettings?.minNo || '',
        serialNo: receiptSettings?.serialNo || '',
        systemDetails: receiptSettings?.systemDetails || '',
        printerName: receiptSettings?.printerName || '',
        printerTin: receiptSettings?.printerTin || '',
        mandatoryDisclaimer: receiptSettings?.mandatoryDisclaimer || receiptSettings?.footerDisclaimer || 'THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX',
        thankYouMessage: receiptSettings?.thankYouMessage || ''
    };

    const normalizedItems = Array.isArray(items) ? items : [];
    const fallbackBaseAmount = Number(transaction?.amount || 0) + Number(discount || 0);
    const receiptItems = normalizedItems.length > 0
        ? normalizedItems
        : (fallbackBaseAmount > 0
            ? [{
                name: String(transaction?.type || 'Transaction').replaceAll('_', ' '),
                price: fallbackBaseAmount,
                quantity: 1
            }]
            : []);

    const subtotal = receiptItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const total = Math.max(0, subtotal - discount);
    const hasVat = settings.vatType === 'VAT';
    const vatRate = Number.isFinite(settings.vatRate) && settings.vatRate >= 0 ? settings.vatRate : 12;
    const vatAmount = hasVat ? (total - (total / (1 + (vatRate / 100)))) : 0;
    const customerName = member
        ? `${member.firstName} ${member.lastName}`
        : (transaction?.customerName || 'WALK-IN CUSTOMER');
    const customerTin = member?.tin || transaction?.customerTin || 'N/A';
    const invoiceNo = String(transaction?.id || 'PENDING');
    const serialNo = settings.serialNo ? `${settings.serialNo}${invoiceNo}` : invoiceNo;

    return (
        <div ref={ref} className="bg-white text-black p-8 font-mono text-sm w-fit min-w-[360px] max-w-full mx-auto border border-gray-200 shadow-sm print:border-0 print:shadow-none">
            {/* Header */}
            <div className="text-center mb-6">
                <p className="text-sm font-bold tracking-wide">{settings.invoiceTitle}</p>
                <h1 className="text-xl font-bold mb-1 mt-1">{settings.businessName}</h1>
                <p className="text-xs mb-1">{settings.branchAddress}</p>
                <p className="text-xs mb-1">TIN: {settings.tin || 'N/A'}</p>
                <p className="text-xs font-bold">{settings.vatType}</p>
                {settings.vatRegTin ? <p className="text-xs mt-1">{settings.vatRegTin}</p> : null}
            </div>

            {/* Body */}
            <div className="mb-4 border-b border-black pb-2 border-dashed">
                <div className="flex justify-between">
                    <span>{settings.issuedDateLabel}:</span>
                    <span>{transactionDate.toLocaleDateString()} {transactionDate.toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between">
                    <span>Invoice #:</span>
                    <span>{invoiceNo}</span>
                </div>
                <div className="flex justify-between">
                    <span>Serial #:</span>
                    <span>{serialNo}</span>
                </div>
                <div className="flex justify-between mt-2">
                    <span>Customer:</span>
                    <span className="text-right">{customerName}</span>
                </div>
                <div className="flex justify-between">
                    <span>Customer TIN:</span>
                    <span className="text-right">{customerTin}</span>
                </div>
                <div className="flex justify-between">
                    <span>Cashier:</span>
                    <span>{cashierName || 'Staff'}</span>
                </div>
            </div>

            {/* Line Items */}
            <div className="mb-4 border-b border-black pb-4 border-dashed min-h-[100px]">
                <table className="w-full text-left">
                    <thead>
                        <tr className="uppercase text-xs">
                            <th className="w-10">Qty</th>
                            <th>Desc</th>
                            <th className="text-right">Price</th>
                            <th className="text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {receiptItems.map((item, idx) => (
                            <tr key={idx}>
                                <td className="align-top">{item.quantity}</td>
                                <td className="align-top pr-2">{item.name}</td>
                                <td className="text-right align-top">{formatPrice(item.price)}</td>
                                <td className="text-right align-top">{formatPrice(item.price * item.quantity)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Totals */}
            <div className="space-y-1 mb-6">
                <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatPrice(subtotal)}</span>
                </div>
                {discount > 0 && (
                    <div className="flex justify-between text-red-600 print:text-black">
                        <span>Discount:</span>
                        <span>-{formatPrice(discount)}</span>
                    </div>
                )}
                {hasVat && (
                    <div className="flex justify-between">
                        <span>VAT ({vatRate}%):</span>
                        <span>{formatPrice(vatAmount)}</span>
                    </div>
                )}
                <div className="flex justify-between font-bold text-lg mt-2 border-t border-dashed border-black pt-2">
                    <span>Total Amount Due:</span>
                    <span>{formatPrice(total)}</span>
                </div>
                {paymentDetails && paymentDetails.method === 'CASH' && (
                    <>
                        <div className="flex justify-between mt-2 text-xs">
                            <span>Cash Tendered:</span>
                            <span>{formatPrice(paymentDetails.tendered ?? transaction?.cashTendered)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span>Change Due:</span>
                            <span>{formatPrice(paymentDetails.change ?? transaction?.changeDue)}</span>
                        </div>
                    </>
                )}
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] space-y-1 mt-8 border-t border-black pt-3 border-dashed">
                <p>PERMIT TO USE NO.: {settings.permitToUseNo || 'N/A'}</p>
                <p>BIR ACCREDITATION NO.: {settings.birAccreditationNo || 'N/A'}</p>
                <p>MIN NO.: {settings.minNo || 'N/A'}</p>
                {settings.systemDetails ? <p>SYSTEM DETAILS: {settings.systemDetails}</p> : null}
                <p>ACCREDITED PRINTER: {settings.printerName || 'N/A'}</p>
                <p>PRINTER TIN: {settings.printerTin || 'N/A'}</p>
                <p className="font-bold mt-2">{settings.mandatoryDisclaimer}</p>
                {settings.thankYouMessage ? <p className="mt-3">{settings.thankYouMessage}</p> : null}
            </div>
            <style>{`
                @media print {
                    @page { size: 80mm auto; margin: 0; }
                    body { -webkit-print-color-adjust: exact; }
                }
            `}</style>
        </div>
    );
});

export default Receipt;
