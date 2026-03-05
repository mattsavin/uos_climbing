import { showToast } from '../../utils';

async function copyTextWithFallback(text: string): Promise<boolean> {
    try {
        if (window.isSecureContext && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    let copied = false;
    try {
        copied = document.execCommand('copy');
    } catch {
        copied = false;
    } finally {
        document.body.removeChild(textArea);
    }

    return copied;
}

export function bindGeneralHandlers(onLogout: () => Promise<void>) {
    const logoutBtn = document.getElementById('logout-btn');
    const icalLinkAll = document.getElementById('ical-link-all');
    const icalLinkBooked = document.getElementById('ical-link-booked');

    const attachIcalCopy = (el: HTMLElement | null, label: string) => {
        if (!el) return;
        el.addEventListener('click', async (e) => {
            e.preventDefault();
            const link = el.dataset.link;
            if (link) {
                const copied = await copyTextWithFallback(link);
                if (copied) {
                    showToast(`Copied ${label} iCal link to your clipboard!`, 'success');
                } else {
                    window.prompt(`Copy your ${label} iCal link:`, link);
                    showToast('Could not copy link. Try manually selecting it if possible.', 'error');
                }
            }
        });
    };

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await onLogout();
            window.location.href = '/login';
        });
    }

    attachIcalCopy(icalLinkAll as HTMLElement | null, 'all sessions');
    attachIcalCopy(icalLinkBooked as HTMLElement | null, 'booked sessions');

    const qrTrigger = document.getElementById('qr-code-trigger');
    const qrOverlay = document.getElementById('membership-card-overlay');
    const closeQrBtn = document.getElementById('close-membership-card-btn');

    if (qrTrigger && qrOverlay) {
        qrTrigger.addEventListener('click', () => {
            qrOverlay.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        });

        const closeCard = () => {
            qrOverlay.classList.add('hidden');
            document.body.style.overflow = '';
        };

        closeQrBtn?.addEventListener('click', closeCard);
        qrOverlay.addEventListener('click', (e) => {
            if (e.target === qrOverlay) closeCard();
        });
    }
}