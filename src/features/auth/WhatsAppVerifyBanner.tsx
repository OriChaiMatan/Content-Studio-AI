import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon';
import { useAuthStore } from '../../stores/authStore';

// Phase 13B — persistent nudge shown app-wide while WhatsApp is linked but not yet
// verified. Verification is NOT a gate (the user already has full access); this just
// keeps the one-time step visible. Hidden once verified, when not linked, or while
// already on the verify page.
export function WhatsAppVerifyBanner() {
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const location = useLocation();

  const wa = user?.whatsapp;
  const show = !!wa?.linked && !wa.verified && location.pathname !== '/verify-whatsapp';
  if (!show) return null;

  return (
    <div className="flex items-center gap-3 border-b border-amber-300/60 bg-amber-50 px-6 py-2.5 text-[13px] text-amber-900">
      <Icon name="chat" size="sm" className="text-amber-700" />
      <span className="flex-1">
        Verify your WhatsApp number to enable WhatsApp features.
      </span>
      <button
        type="button"
        onClick={() => navigate('/verify-whatsapp')}
        className="font-bold underline-offset-4 hover:underline"
      >
        Verify now
      </button>
    </div>
  );
}
