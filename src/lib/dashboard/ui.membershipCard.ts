import type { User } from '../../auth';
import { getVerificationWord } from '../../utils';
import QRCode from 'qrcode';

export function renderMembershipCard(user: User, displayName: string, currentYearStr: string) {
    const membershipCardContainer = document.getElementById('membership-card-container');
    if (!membershipCardContainer) return;

    const hasActiveMembership = (user.membershipStatus === 'active' || user.role === 'committee');
    if (!hasActiveMembership) {
        membershipCardContainer.classList.add('hidden');
        return;
    }

    membershipCardContainer.classList.remove('hidden');
    const cardName = document.getElementById('card-user-name');
    const cardReg = document.getElementById('card-user-reg');
    const cardYear = document.getElementById('card-academic-year');

    if (cardName) cardName.textContent = displayName;
    if (cardReg) cardReg.textContent = `ID: ${user.registrationNumber || '12345678'}`;
    if (cardYear) cardYear.textContent = user.membershipYear || currentYearStr;

    const wordOfTheDay = getVerificationWord();
    const cardWordEl = document.getElementById('card-word-of-the-day');
    const modalWordEl = document.getElementById('modal-word-of-the-day');
    if (cardWordEl) cardWordEl.textContent = wordOfTheDay;
    if (modalWordEl) modalWordEl.textContent = wordOfTheDay;

    const cardPhoto = document.getElementById('card-user-photo') as HTMLImageElement;
    const cardPhotoPlaceholder = document.getElementById('card-photo-placeholder');
    const modalPhoto = document.getElementById('modal-card-user-photo') as HTMLImageElement;
    const modalPhotoPlaceholder = document.getElementById('modal-card-photo-placeholder');

    if (user.profilePhoto) {
        if (cardPhoto) {
            cardPhoto.src = user.profilePhoto;
            cardPhoto.classList.remove('hidden');
        }
        if (cardPhotoPlaceholder) cardPhotoPlaceholder.classList.add('hidden');
        if (modalPhoto) {
            modalPhoto.src = user.profilePhoto;
            modalPhoto.classList.remove('hidden');
        }
        if (modalPhotoPlaceholder) modalPhotoPlaceholder.classList.add('hidden');
    } else {
        cardPhoto?.classList.add('hidden');
        cardPhotoPlaceholder?.classList.remove('hidden');
        modalPhoto?.classList.add('hidden');
        modalPhotoPlaceholder?.classList.remove('hidden');
    }

    const modalLiveDate = document.getElementById('modal-live-date');
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    if (modalLiveDate) modalLiveDate.textContent = dateStr;

    const qrContainer = document.getElementById('card-qr-container');
    if (qrContainer) {
        const verifyUrl = `${window.location.origin}/verify/${user.calendarToken || user.id}`;

        QRCode.toString(verifyUrl, {
            type: 'svg',
            margin: 0,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        }, (err, svg) => {
            if (!err) {
                const styledSvg = svg.replace('<svg ', '<svg class="w-full h-full" ');
                qrContainer.innerHTML = styledSvg;
                const modalQrContainer = document.getElementById('enlarged-qr-container');
                if (modalQrContainer) modalQrContainer.innerHTML = styledSvg;
            }
        });
    }

    const expiryContainer = document.getElementById('card-expiry-container');
    const expiryDateText = document.getElementById('card-expiry-date');
    const modalExpiryText = document.getElementById('modal-card-expiry');

    if (expiryContainer && expiryDateText) {
        const parts = (user.membershipYear || currentYearStr).split('/');
        if (parts.length === 2) {
            const expiryYear = parts[1].length === 2 ? `20${parts[1]}` : parts[1];
            const expiryDateStr = `31 Aug ${expiryYear}`;
            expiryDateText.textContent = expiryDateStr;
            expiryContainer.classList.remove('hidden');
            if (modalExpiryText) modalExpiryText.textContent = expiryDateStr;
        }
    }

    const modalName = document.getElementById('modal-card-user-name');
    const modalReg = document.getElementById('modal-card-user-reg');
    if (modalName) modalName.textContent = displayName;
    if (modalReg) modalReg.textContent = `ID: ${user.registrationNumber || '12345678'}`;
}