import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';
import DoorScanner from '../staff/DoorScanner';
import Attendance from '../member/Attendance';

export default function Access() {
    const { user } = useAuth();

    if (user.role === ROLES.MEMBER) {
        return <Attendance />;
    } else {
        return <DoorScanner />;
    }
}
