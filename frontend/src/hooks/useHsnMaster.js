import { useSelector, useDispatch } from 'react-redux';
import { useCallback } from 'react';
import {
    fetchHsnMasterList,
    fetchHsnMasterById,
    createHsnMaster,
    updateHsnMaster,
    deleteHsnMaster,
    toggleHsnMasterStatus,
    fetchHsnDropdownList,
    clearHsnError,
    clearSelectedHsn
} from '../redux/hsn/hsnSlice';

export const useHsnPermissions = () => {
    const user = useSelector((state) => state.auth.user) || JSON.parse(localStorage.getItem('user') || '{}');
    const isSellerOrAdmin = user.role === 'SELLER' || user.role === 'SUPERADMIN';

    const hasPermission = useCallback((permission) => {
        if (isSellerOrAdmin) return true;
        if (!user.permissions || !user.permissions.Masters) return false;

        const mastersPerms = user.permissions.Masters;
        switch (permission) {
            case 'HSN_MASTER_VIEW':
            case 'HSN_MASTER_EXPORT':
                return !!mastersPerms.canView;
            case 'HSN_MASTER_CREATE':
                return !!mastersPerms.canCreate;
            case 'HSN_MASTER_EDIT':
                return !!mastersPerms.canUpdate;
            case 'HSN_MASTER_DELETE':
                return !!mastersPerms.canDelete;
            default:
                return false;
        }
    }, [user, isSellerOrAdmin]);

    return {
        canView: hasPermission('HSN_MASTER_VIEW'),
        canCreate: hasPermission('HSN_MASTER_CREATE'),
        canEdit: hasPermission('HSN_MASTER_EDIT'),
        canDelete: hasPermission('HSN_MASTER_DELETE'),
        canExport: hasPermission('HSN_MASTER_EXPORT'),
        hasPermission
    };
};

export const useHsnMaster = () => {
    const dispatch = useDispatch();
    const { hsnList, total, page, limit, totalPages, selectedHsn, loading, error, dropdownList } = useSelector((state) => state.hsn);

    const getHsnList = useCallback((params) => {
        return dispatch(fetchHsnMasterList(params));
    }, [dispatch]);

    const getHsnById = useCallback((id) => {
        return dispatch(fetchHsnMasterById(id));
    }, [dispatch]);

    const createHsn = useCallback((data) => {
        return dispatch(createHsnMaster(data));
    }, [dispatch]);

    const updateHsn = useCallback((id, data) => {
        return dispatch(updateHsnMaster({ id, data }));
    }, [dispatch]);

    const deleteHsn = useCallback((id) => {
        return dispatch(deleteHsnMaster(id));
    }, [dispatch]);

    const toggleHsnStatus = useCallback(({ id, isActive }) => {
        return dispatch(toggleHsnMasterStatus({ id, isActive }));
    }, [dispatch]);

    const getHsnDropdown = useCallback(() => {
        return dispatch(fetchHsnDropdownList());
    }, [dispatch]);

    const clearError = useCallback(() => {
        dispatch(clearHsnError());
    }, [dispatch]);

    const clearSelected = useCallback(() => {
        dispatch(clearSelectedHsn());
    }, [dispatch]);

    return {
        hsnList,
        total,
        page,
        limit,
        totalPages,
        selectedHsn,
        loading,
        error,
        dropdownList,
        getHsnList,
        getHsnById,
        createHsn,
        updateHsn,
        deleteHsn,
        toggleHsnStatus,
        getHsnDropdown,
        clearError,
        clearSelected
    };
};
