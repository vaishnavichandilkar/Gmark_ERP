import { Outlet } from 'react-router-dom';

const LanguageGuard = () => {
    // Default to English and mark language confirmed if not present
    if (!localStorage.getItem('languageConfirmed')) {
        localStorage.setItem('languageConfirmed', 'true');
    }
    if (!localStorage.getItem('selectedLanguage')) {
        localStorage.setItem('selectedLanguage', 'en');
    }

    return <Outlet context={{ isLanguageSelected: true }} />;
};

export default LanguageGuard;
