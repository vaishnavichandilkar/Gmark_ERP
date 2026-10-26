import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { getWeighingDevices } from '../../../../services/manufacturerService';

/**
 * Determines whether a weighing machine is one of the 2 pre-seeded default machines
 * (SCALE-01 or SIMULATOR-01) rather than a machine registered/inserted by the user.
 */
export const isDefaultSeedMachine = (device) => {
    if (!device) return false;
    const id = String(device.id || '').trim().toUpperCase();
    const name = String(device.deviceName || device.device_name || '').trim().toLowerCase();

    // 1. Virtual simulator machine
    if (
        id === 'SIMULATOR-01' ||
        name.includes('virtual platform scale simulator') ||
        device.connectionType === 'SIMULATOR' ||
        device.protocol === 'SIMULATOR'
    ) {
        return true;
    }

    // 2. Default bench scale
    if (
        id === 'SCALE-01' &&
        (name.includes('packaging line scale #1') || name.includes('scale #1 (bench)') || !name)
    ) {
        return true;
    }

    return false;
};

/**
 * Checks registered weighing machines and directs user to:
 * - /seller/inventory/packaging (if user has inserted/registered at least one machine beyond the 2 default machines)
 * - /seller/inventory/machines (if user is new / only has the 2 default machines / zero machines)
 * - Displays loading/error state while waiting or upon failure without premature redirection.
 */
const InventoryLandingRedirect = () => {
    const [status, setStatus] = useState({
        loading: true,
        error: null,
        target: null,
    });
    const isMountedRef = useRef(true);

    const checkMachines = useCallback(async () => {
        setStatus({ loading: true, error: null, target: null });
        try {
            const result = await getWeighingDevices();
            if (!isMountedRef.current) return;
            const list = Array.isArray(result) ? result : (result?.data || result?.devices || []);
            // Exclude the 2 default system/seed machines so new users land on Machine Management
            const userMachines = list.filter((device) => !isDefaultSeedMachine(device));

            if (userMachines.length > 0) {
                setStatus({ loading: false, error: null, target: '/seller/inventory/packaging' });
            } else {
                setStatus({ loading: false, error: null, target: '/seller/inventory/machines' });
            }
        } catch (err) {
            if (!isMountedRef.current) return;
            console.error('Failed to verify registered weighing machines for landing page:', err);
            const msg =
                err?.response?.data?.message ||
                err?.message ||
                'Failed to load registered weighing machines';
            setStatus({ loading: false, error: msg, target: null });
        }
    }, []);

    useEffect(() => {
        isMountedRef.current = true;
        checkMachines();
        return () => {
            isMountedRef.current = false;
        };
    }, [checkMachines]);

    if (status.loading) {
        return (
            <div className="py-20 text-center flex flex-col items-center justify-center font-outfit">
                <RefreshCw size={32} className="animate-spin text-[#073318] mb-3" />
                <p className="text-[14px] text-gray-600 font-medium">
                    Loading inventory station...
                </p>
            </div>
        );
    }

    if (status.error) {
        return (
            <div className="p-8 text-center flex flex-col items-center justify-center bg-rose-50/50 border border-rose-200 rounded-xl my-6 font-outfit max-w-lg mx-auto">
                <AlertCircle size={36} className="text-rose-600 mb-2" />
                <h4 className="text-[16px] font-bold text-rose-900 mb-1">
                    Failed to Load Machine Registry
                </h4>
                <p className="text-[13px] text-rose-700 max-w-md mb-4 leading-relaxed">
                    {status.error}
                </p>
                <button
                    onClick={checkMachines}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[13px] font-semibold transition-all shadow-sm active:scale-95"
                >
                    <RefreshCw size={14} />
                    <span>Retry</span>
                </button>
            </div>
        );
    }

    if (status.target) {
        return <Navigate to={status.target} replace />;
    }

    return null;
};

export default InventoryLandingRedirect;
