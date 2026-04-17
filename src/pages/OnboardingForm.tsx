import { Navigate, useParams, useLocation } from 'react-router-dom';

/** Legacy redirect: /onboarding/:tenancy → /onboarding/agency|builder (preserves query string). */
export default function OnboardingForm() {
  const { tenancy } = useParams<{ tenancy: string }>();
  const { search } = useLocation();
  const target = tenancy === 'builder' ? '/onboarding/builder' : '/onboarding/agency';
  return <Navigate to={`${target}${search}`} replace />;
}
