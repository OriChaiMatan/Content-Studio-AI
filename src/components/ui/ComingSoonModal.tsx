import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { Button } from './Button';
import { useComingSoonModalStore } from '../../stores/comingSoonModalStore';

const BENEFITS = [
  'More active content cases',
  'More sources per cycle',
  'More pipeline runs',
  'More image generations',
  'Priority processing',
  'Early access to new capabilities',
];

// The ONE shared "LumAI Pro is coming soon" modal — mounted once at the App
// root (works from both the authenticated app and the public marketing site,
// since it's always in the main bundle, not the lazy-loaded marketing chunk).
// There is no purchasable Pro plan yet: every Upgrade/Waitlist CTA anywhere in
// the product opens this exact modal instead of its own copy or a mailto link.
export function ComingSoonModal() {
  const open = useComingSoonModalStore(s => s.open);
  const close = useComingSoonModalStore(s => s.close);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  function joinWaitlist() {
    close();
    // No waitlist form yet — reuse the existing (real, backend-wired) contact
    // flow. Works from any route since it's a plain navigation.
    navigate('/contact');
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40"
      onClick={close}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="coming-soon-modal-title"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 overflow-hidden"
      >
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-secondary-container flex items-center justify-center shrink-0">
              <Icon name="rocket_launch" className="text-secondary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="coming-soon-modal-title" className="text-[17px] font-semibold text-on-surface leading-tight">
                LumAI Pro is coming soon
              </h2>
              <p className="text-[13px] text-on-surface-variant mt-1 leading-relaxed">
                The Free plan already includes the complete LumAI thinking engine.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-surface-container-low px-4 py-3 mb-4">
            <p className="text-[12.5px] font-semibold text-on-surface-variant uppercase tracking-wide mb-2">
              LumAI Pro will unlock
            </p>
            <ul className="space-y-1.5">
              {BENEFITS.map(b => (
                <li key={b} className="flex items-start gap-2 text-[13px] text-on-surface">
                  <Icon name="check" size="sm" className="text-secondary shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[12px] text-on-surface-variant mb-5">
            Early adopters will receive a special launch offer.
          </p>

          <div className="flex flex-col gap-2">
            <Button fullWidth onClick={joinWaitlist}>
              <Icon name="mail" size="sm" />
              Join the Waitlist
            </Button>
            <Button variant="ghost" fullWidth onClick={close}>
              Continue with Free
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
