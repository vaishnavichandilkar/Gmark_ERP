import { API_BASE_URL } from '../config/api.config';

export const BASE_URL = API_BASE_URL;
export const AUTH_ENDPOINTS = {
  SEND_LOGIN_OTP: '/auth/send-login-otp',
  LOGIN: '/auth/login',
  LOGIN_WITH_PASSWORD: '/auth/login-password',
  LOGOUT: '/auth/logout',
  REFRESH_TOKEN: '/auth/refresh-token',
  PROFILE: '/auth/me',
  RESEND_OTP: '/auth/resend-otp',
};
export const ONBOARDING_ENDPOINTS = {
  START: '/seller/onboarding/start',
  STATUS: '/seller/onboarding/status',
  SUBMIT_STEP: (step) => `/seller/onboarding/step/${step}`,
  // Legacy steps (keeping for now to avoid breaking changes until migrated)
  STEP1_LANGUAGE: '/onboarding/step1-language',
  STEP2_MOBILE: '/onboarding/step2-mobile',
  STEP3_VERIFY: '/onboarding/step3-verify',
  STEP4_DETAILS: '/onboarding/step4-details',
  STEP5_SHOP: '/onboarding/step5-shop',
  STEP6_BUSINESS: '/onboarding/step6-business',
  STEP7_COMPLETE: '/onboarding/step7-complete',
  RESEND_OTP: '/onboarding/resend-otp',
};
export const DASHBOARD_ENDPOINTS = {
  STATS: '/dashboard/stats',
};
