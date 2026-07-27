export const getSafeUser = () => {
  try {
    const item = localStorage.getItem('user');
    if (!item || item === 'undefined') return {};
    return JSON.parse(item) || {};
  } catch (e) {
    console.error('Failed to parse user from localStorage', e);
    return {};
  }
};
