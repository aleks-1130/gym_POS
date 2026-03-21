import React from 'react';
import { useAuth } from '../context/AuthContext';

// This component can be used in a modal or hidden iframe for printing
export const Receipt = React.forwardRef(({ transaction, items, member, cashierName, discount = 0, paymentDetails, receiptSettings }, ref) => {
    const { user } = useAuth();
    const transactionCurrency = transaction?.currency || 'PHP';
    const transactionLocale = transactionCurrency === 'SGD' ? 'en-SG' : 'en-PH';

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat(transactionLocale, {
            style: 'currency',
            currency: transactionCurrency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount || 0);
    };

    const transactionDate = transaction?.date ? new Date(transaction.date) : new Date();

    const settings = {
        invoiceTitle: receiptSettings?.invoiceTitle || 'SALES INVOICE',
        businessName: receiptSettings?.businessName || user?.gym?.name || 'FitOS Gym',
        branchAddress: receiptSettings?.branchAddress || user?.gym?.address || '123 Fitness Blvd, Gym City',
        tin: receiptSettings?.tin || '',
        vatType: String(receiptSettings?.vatType || 'VAT').toUpperCase() === 'NON-VAT' ? 'NON-VAT' : 'VAT',
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
    const vatRate = Number.isFinite(user?.gym?.taxRate) && user?.gym?.taxRate >= 0 ? user.gym.taxRate : 12;

    const memberFullName = [member?.firstName, member?.lastName].filter(Boolean).join(' ').trim();
    const customerName = memberFullName
        || member?.name
        || member?.fullName
        || transaction?.customerName
        || 'WALK-IN CUSTOMER';
    const customerTin = member?.tin || transaction?.customerTin || 'N/A';
    
    // Dynamic Invoice Logic
    const invoiceNo = transaction?.referenceId || String(transaction?.id || 'PENDING');
    const companyId = transaction?.companyId || user?.gym?.companyId || 'FITOS_GYM_001';
    const serialNo = settings.serialNo ? `${settings.serialNo}${invoiceNo}` : invoiceNo;

    return (
        <div ref={ref} className="bg-white text-black p-8 font-mono text-sm w-fit min-w-[360px] max-w-full mx-auto border border-gray-200 shadow-sm print:border-0 print:shadow-none">
            {/* Header */}
            <div className="text-center mb-6">
                <p className="text-sm font-bold tracking-wide">{settings.invoiceTitle}</p>
                <h1 className="text-xl font-bold mb-1 mt-1">{settings.businessName}</h1>
                <p className="text-xs mb-1">{settings.branchAddress}</p>
                <div className="flex justify-center gap-4 text-[10px] opacity-75">
                    <span>TIN: {settings.tin || 'N/A'}</span>
                    <span>ID: {companyId}</span>
                </div>
                <p className="text-xs font-bold mt-1 uppercase tracking-wider">{settings.vatType}</p>
                {settings.vatRegTin ? <p className="text-xs mt-1">{settings.vatRegTin}</p> : null}
            </div>

            {/* Body */}
            <div className="mb-4 border-b border-black pb-2 border-dashed">
                <div className="flex justify-between">
                    <span>{settings.issuedDateLabel}:</span>
                    <span>{transactionDate.toLocaleDateString()} {transactionDate.toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between font-bold">
                    <span>Reference #:</span>
                    <span>{invoiceNo}</span>
                </div>
                <div className="flex justify-between text-[10px] opacity-70">
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
                        <tr className="uppercase text-xs border-b border-black border-dotted">
                            <th className="w-10 pb-1">Qty</th>
                            <th className="pb-1">Desc</th>
                            <th className="text-right pb-1">Price</th>
                            <th className="text-right pb-1">Total</th>
                        </tr>
                    </thead>
                    <tbody className="pt-2">
                        {receiptItems.map((item, idx) => (
                            <tr key={idx} className="text-xs">
                                <td className="align-top py-1">{item.quantity}</td>
                                <td className="align-top pr-2 py-1">{item.name}</td>
                                <td className="text-right align-top py-1">{formatCurrency(item.price)}</td>
                                <td className="text-right align-top py-1">{formatCurrency(item.price * item.quantity)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Totals */}
            <div className="space-y-1 mb-6 text-sm">
                <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                    <div className="flex justify-between text-black">
                        <span>Discount:</span>
                        <span>-{formatCurrency(discount)}</span>
                    </div>
                )}
                {transaction?.couponCode && transaction?.couponDiscount > 0 && (
                    <div className="flex justify-between text-black">
                        <span>Coupon ({transaction.couponCode}):</span>
                        <span>-{formatCurrency(transaction.couponDiscount)}</span>
                    </div>
                )}
                {transaction?.pointsAwarded > 0 && (
                    <div className="flex justify-between text-black">
                        <span>Points Earned:</span>
                        <span>+{transaction.pointsAwarded}</span>
                    </div>
                )}
                
                <div className="border-t border-black border-dotted my-2 pt-2">
                    <div className="flex justify-between text-xs opacity-75">
                        <span>Taxable Amount:</span>
                        <span>{formatCurrency(transaction?.taxableAmount || (total / (1 + (vatRate / 100))))}</span>
                    </div>
                    <div className="flex justify-between text-xs opacity-75">
                        <span>VAT ({vatRate}%):</span>
                        <span>{formatCurrency(transaction?.taxAmount || (total - (total / (1 + (vatRate / 100)))))}</span>
                    </div>
                    {Number(transaction?.roundingAdjustment || 0) !== 0 && (
                        <div className="flex justify-between text-xs opacity-75">
                            <span>Rounding:</span>
                            <span>{formatCurrency(transaction?.roundingAdjustment)}</span>
                        </div>
                    )}
                </div>

                <div className="flex justify-between font-bold text-lg mt-2 border-t border-dashed border-black pt-2">
                    <span>Payable Amount:</span>
                    <span>{formatCurrency(transaction?.payableAmount || total)}</span>
                </div>

                <div className="mt-4 pt-2 border-t border-dotted border-black">
                    <div className="flex justify-between text-xs font-bold">
                        <span>Payment Method:</span>
                        <span>{(transaction?.method || paymentDetails?.method || 'N/A').replaceAll('_', ' ')}</span>
                    </div>
                    {paymentDetails && paymentDetails.method === 'CASH' && (
                        <>
                            <div className="flex justify-between text-xs mt-1">
                                <span>Cash Tendered:</span>
                                <span>{formatCurrency(paymentDetails.tendered ?? transaction?.cashTendered)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span>Change Due:</span>
                                <span>{formatCurrency(paymentDetails.change ?? transaction?.changeDue)}</span>
                            </div>
                        </>
                    )}
                    {transaction?.financialInstitutionId && (
                        <div className="flex justify-between text-[10px] opacity-60 italic">
                            <span>Financial Inst. ID:</span>
                            <span>{transaction.financialInstitutionId}</span>
                        </div>
                    )}
                </div>
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
