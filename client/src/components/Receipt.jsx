import React from 'react';
import { useCurrency } from '../context/CurrencyContext';

// This component can be used in a modal or hidden iframe for printing
export const Receipt = React.forwardRef(({ transaction, items, member, cashierName, discount = 0, paymentDetails }, ref) => {
    const { formatPrice } = useCurrency();
    const date = new Date();

    // Gym Info (Hardcoded for now, ideal if from config)
    const gymInfo = {
        name: "IRON FORGE GYM",
        address: "123 Fitness Blvd, Muscle City, CA 90210",
        tin: "123-456-789-000",
        vatReg: "VAT REG TIN: 123-456-789-000"
    };

    // Calculations
    const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const total = Math.max(0, subtotal - discount);

    // VAT Calculation (Philippines: 12% existing in price usually, but let's assume price is VAT inclusive)
    // VATable Sales = Total / 1.12
    // VAT Amount = Total - VATable Sales
    const vatableSales = total / 1.12;
    const vatAmount = total - vatableSales;

    return (
        <div ref={ref} className="bg-white text-black p-8 font-mono text-sm max-w-[400px] mx-auto border border-gray-200 shadow-sm print:border-0 print:shadow-none">
            {/* Header */}
            <div className="text-center mb-6">
                <h1 className="text-xl font-bold mb-1">{gymInfo.name}</h1>
                <p className="text-xs mb-1">{gymInfo.address}</p>
                <p className="text-xs">{gymInfo.vatReg}</p>
            </div>

            {/* Transaction Details */}
            <div className="mb-4 border-b border-black pb-2 border-dashed">
                <div className="flex justify-between">
                    <span>Date:</span>
                    <span>{date.toLocaleDateString()} {date.toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between">
                    <span>Invoice #:</span>
                    <span>{transaction?.id || 'PENDING'}</span>
                </div>
                <div className="flex justify-between">
                    <span>Cashier:</span>
                    <span>{cashierName || 'Staff'}</span>
                </div>
                {member && (
                    <div className="flex justify-between mt-2">
                        <span>Member:</span>
                        <span className="text-right">{member.firstName} {member.lastName}</span>
                    </div>
                )}
            </div>

            {/* Line Items */}
            <div className="mb-4 border-b border-black pb-4 border-dashed min-h-[100px]">
                <table className="w-full text-left">
                    <thead>
                        <tr className="uppercase text-xs">
                            <th className="w-10">Qty</th>
                            <th>Desc</th>
                            <th className="text-right">Price</th>
                            <th className="text-right">Amt</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => (
                            <tr key={idx}>
                                <td className="align-top">{item.quantity}</td>
                                <td className="align-top pr-2">{item.name}</td>
                                <td className="text-right align-top">{formatPrice(item.price).replace('$', '')}</td>
                                <td className="text-right align-top">{formatPrice(item.price * item.quantity).replace('$', '')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Totals */}
            <div className="space-y-1 mb-6">
                <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatPrice(subtotal).replace('$', '')}</span>
                </div>
                {discount > 0 && (
                    <div className="flex justify-between text-red-600 print:text-black">
                        <span>Discount:</span>
                        <span>-{formatPrice(discount).replace('$', '')}</span>
                    </div>
                )}
                <div className="flex justify-between font-bold text-lg mt-2 border-t border-dashed border-black pt-2">
                    <span>TOTAL:</span>
                    <span>{formatPrice(total)}</span>
                </div>
                {paymentDetails && paymentDetails.method === 'CASH' && (
                    <>
                        <div className="flex justify-between mt-2 text-xs">
                            <span>Cash Tendered:</span>
                            <span>{formatPrice(paymentDetails.tendered)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span>Change Due:</span>
                            <span>{formatPrice(paymentDetails.change)}</span>
                        </div>
                    </>
                )}
            </div>

            {/* Tax Breakdown */}
            <div className="text-xs mb-6 border-t border-black pt-2 border-dashed">
                <div className="flex justify-between">
                    <span>VATable Sales:</span>
                    <span>{formatPrice(vatableSales).replace('$', '')}</span>
                </div>
                <div className="flex justify-between">
                    <span>VAT Amount (12%):</span>
                    <span>{formatPrice(vatAmount).replace('$', '')}</span>
                </div>
                <div className="flex justify-between">
                    <span>VAT Exempt Sales:</span>
                    <span>0.00</span>
                </div>
                <div className="flex justify-between">
                    <span>Zero Rated Sales:</span>
                    <span>0.00</span>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] space-y-1 mt-8">
                <p className="font-bold">THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX</p>
                <p>ACCREDITED PRINTER: SUPER PRINTS INC.</p>
                <p>TIN: 999-888-777-000</p>
                <p>Date Issued: {date.toLocaleDateString()}</p>
                <p className="mt-4">Thank you for training with us!</p>
            </div>
        </div>
    );
});

export default Receipt;
