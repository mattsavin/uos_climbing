type DomainPopupElements = {
    popup: HTMLElement | null;
    backdrop: HTMLElement | null;
    title: HTMLElement | null;
    closeButton: HTMLElement | null;
    confirmButton: HTMLButtonElement | null;
    message: HTMLElement | null;
    confirmWrap: HTMLElement | null;
    confirmInput: HTMLInputElement | null;
    confirmError: HTMLElement | null;
};

export function createDomainEmailPopupController(elements: DomainPopupElements) {
    const {
        popup,
        backdrop,
        title,
        closeButton,
        confirmButton,
        message,
        confirmWrap,
        confirmInput,
        confirmError
    } = elements;

    let popupResolve: ((confirmed: boolean) => void) | null = null;
    let popupExpectedRegistrationNumber: string | null = null;

    const closeDomainEmailPopup = (confirmed = false) => {
        popup?.classList.add('hidden');
        if (popupResolve) {
            const resolve = popupResolve;
            popupResolve = null;
            resolve(confirmed);
        }
    };

    const showDomainEmailPopup = (popupMessage: string, popupTitle = 'University Email Required') => {
        if (popupResolve) {
            popupResolve(false);
            popupResolve = null;
        }
        popupExpectedRegistrationNumber = null;
        if (title) title.textContent = popupTitle;
        if (message) message.textContent = popupMessage;
        if (confirmWrap) confirmWrap.classList.add('hidden');
        if (confirmInput) confirmInput.value = '';
        if (confirmError) {
            confirmError.classList.add('hidden');
            confirmError.textContent = '';
        }
        if (confirmButton) confirmButton.classList.add('hidden');
        if (closeButton) closeButton.textContent = 'Got it';
        popup?.classList.remove('hidden');
    };

    const showRegistrationNumberOverridePopup = (registrationNumber: string): Promise<boolean> => {
        if (popupResolve) {
            popupResolve(false);
            popupResolve = null;
        }
        popupExpectedRegistrationNumber = registrationNumber;
        if (title) title.textContent = 'Check Registration Number';
        if (message) {
            message.textContent =
                'Registration numbers normally start with 2 (for example: 2xxxxxxxx). If you continue, your membership may not link properly and you will not be able to change this value later. Please double-check before continuing.';
        }
        if (closeButton) closeButton.textContent = 'Go back';
        if (confirmButton) {
            confirmButton.textContent = 'Continue anyway';
            confirmButton.disabled = true;
            confirmButton.classList.remove('hidden');
        }
        if (confirmWrap) confirmWrap.classList.remove('hidden');
        if (confirmInput) {
            confirmInput.value = '';
            confirmInput.focus();
        }
        if (confirmError) {
            confirmError.classList.add('hidden');
            confirmError.textContent = '';
        }
        popup?.classList.remove('hidden');
        return new Promise((resolve) => {
            popupResolve = resolve;
        });
    };

    [backdrop, closeButton].forEach((el) => {
        el?.addEventListener('click', () => closeDomainEmailPopup(false));
    });

    confirmButton?.addEventListener('click', () => closeDomainEmailPopup(true));

    confirmInput?.addEventListener('input', () => {
        if (!popupExpectedRegistrationNumber || !confirmButton || !confirmError) return;
        const typed = confirmInput.value.trim();
        const matches = typed === popupExpectedRegistrationNumber;
        confirmButton.disabled = !matches;
        if (!typed || matches) {
            confirmError.classList.add('hidden');
            confirmError.textContent = '';
            return;
        }
        confirmError.textContent = 'Registration numbers do not match yet.';
        confirmError.classList.remove('hidden');
    });

    return {
        showDomainEmailPopup,
        showRegistrationNumberOverridePopup
    };
}