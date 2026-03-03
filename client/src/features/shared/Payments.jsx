import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';
import StaffPOS from '../staff/POS';
import AdminPOS from '../admin/POS';
import PurchaseHistory from '../member/PurchaseHistory';

export default function Payments() {
    const { user } = useAuth();

    if (user.role === ROLES.MEMBER) {
        return <PurchaseHistory />;
    }
    if (user.role === ROLES.ADMIN) {
        return <AdminPOS />;
    }
    if (user.role === ROLES.STAFF) {
        return <StaffPOS />;
    }

    return <Navigate to="/dashboard" replace />;
}
