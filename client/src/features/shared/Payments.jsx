import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';
import POS from '../staff/POS';
import PurchaseHistory from '../member/PurchaseHistory';

export default function Payments() {
    const { user } = useAuth();
    // Assuming staff/owner/admin see POS, member see History
    if (user.role === ROLES.MEMBER) {
        return <PurchaseHistory />;
    } else {
        return <POS />;
    }
}
