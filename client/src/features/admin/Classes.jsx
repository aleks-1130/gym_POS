import React from 'react';
import { useAuth } from '../../context/AuthContext';
import ClassesManagement from '../shared/ClassesManagement';

export default function AdminClasses() {
    const { user } = useAuth();
    return <ClassesManagement viewRole={user?.role || 'ADMIN'} />;
}

