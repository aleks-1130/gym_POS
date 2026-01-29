import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';
import LoyaltyManager from '../staff/LoyaltyManager';
import Rewards from '../member/Rewards';

export default function Loyalty() {
    const { user } = useAuth();

    if (user.role === ROLES.MEMBER) {
        return <Rewards />;
    } else {
        return <LoyaltyManager />;
    }
}
