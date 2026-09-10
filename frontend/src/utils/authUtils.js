import { getProfileApi } from '../services/authService';

export const handleLoginSuccess = async (response, navigate) => {
    if (response.accessToken) {
        localStorage.setItem('token', response.accessToken);
    }

    if (response.refreshToken) {
        localStorage.setItem('refreshToken', response.refreshToken);
    }

    let userRole = response.user?.role;
    if (!userRole && response.accessToken) {
        try {
            const { jwtDecode } = await import('jwt-decode');
            const decoded = jwtDecode(response.accessToken);
            userRole = decoded.role || decoded.userRole;
        } catch (e) {
            console.error("Failed to decode token", e);
        }
    }

    if (response.user) {
        localStorage.setItem('user', JSON.stringify(response.user));

        const dbLanguage = response.user.selectedLanguage || response.user.selected_language;
        if (dbLanguage) {
            localStorage.setItem('selectedLanguage', dbLanguage);
            localStorage.setItem('i18nextLng', dbLanguage);
            localStorage.setItem('languageConfirmed', 'true');

            import('../i18n').then(module => {
                module.default.changeLanguage(dbLanguage);
            });
        }
    }

    if (userRole === 'SUPERADMIN' || userRole === 'superadmin') {
        navigate('/superadmin/dashboard', { replace: true });
        return;
    }

    if (userRole === 'SELLER' || userRole === 'seller') {
        try {
            const freshProfile = await getProfileApi();
            const status = freshProfile.approvalStatus;
            const isFirst = freshProfile.isFirstApprovalLogin;

            const updatedUser = { ...response.user, approvalStatus: status, isFirstApprovalLogin: isFirst };
            localStorage.setItem('user', JSON.stringify(updatedUser));

            if (status === 'APPROVED') {
                if (isFirst) {
                    navigate('/application-status', {
                        state: { status, isFirstApprovalLogin: true },
                        replace: true
                    });
                } else {
                    navigate('/seller/reports', { replace: true });
                }
                return;
            }

            navigate('/application-status', {
                state: {
                    status,
                    rejectionReason: freshProfile.rejectionReason,
                    isFirstApprovalLogin: isFirst
                },
                replace: true
            });
            return;

        } catch (err) {
            console.error("Failed to fetch DB status during login", err);
            navigate('/application-status', { replace: true });
            return;
        }
    }

    // Default route for standard users / operators
    navigate('/success', { state: { mode: 'login' } });
};
