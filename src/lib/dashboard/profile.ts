import { authState } from '../../auth';

export function initProfileHandlers() {
    const profileForm = document.getElementById('profile-form');
    const profileFName = document.getElementById('profile-fname') as HTMLInputElement;
    const profileSName = document.getElementById('profile-sname') as HTMLInputElement;
    const profilePronouns = document.getElementById('profile-pronouns') as HTMLInputElement;
    const profileDietary = document.getElementById('profile-dietary') as HTMLInputElement;
    const profileEmergencyName = document.getElementById('profile-emergency-name') as HTMLInputElement;
    const profileEmergencyMobile = document.getElementById('profile-emergency-mobile') as HTMLInputElement;
    const profileSuccess = document.getElementById('profile-success');
    const profileError = document.getElementById('profile-error');
    const userNameSpan = document.getElementById('user-name');

    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = profileForm.querySelector('button[type="submit"]') as HTMLButtonElement | null;
            if (profileSuccess) profileSuccess.classList.add('hidden');
            if (profileError) profileError.classList.add('hidden');

            try {
                if (submitBtn) submitBtn.disabled = true;
                if (submitBtn) submitBtn.textContent = 'Updating...';

                await authState.updateProfile(
                    profileFName.value.trim(),
                    profileSName.value.trim(),
                    profileEmergencyName.value.trim(),
                    profileEmergencyMobile.value.trim(),
                    profilePronouns.value.trim(),
                    profileDietary.value.trim()
                );

                if (profileSuccess) profileSuccess.classList.remove('hidden');
                if (userNameSpan) userNameSpan.textContent = authState.user?.name || '';
            } catch (err: any) {
                if (profileError) {
                    profileError.textContent = err.message || 'Failed to update profile setting.';
                    profileError.classList.remove('hidden');
                }
            } finally {
                if (submitBtn) submitBtn.disabled = false;
                if (submitBtn) submitBtn.textContent = 'Save Profile';
            }
        });
    }

    const passwordForm = document.getElementById('password-form');
    const passCurrent = document.getElementById('password-current') as HTMLInputElement;
    const passNew = document.getElementById('password-new') as HTMLInputElement;
    const passConfirm = document.getElementById('password-confirm') as HTMLInputElement;
    const passSuccess = document.getElementById('password-success');
    const passError = document.getElementById('password-error');

    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = passwordForm.querySelector('button[type="submit"]') as HTMLButtonElement | null;
            if (passSuccess) passSuccess.classList.add('hidden');
            if (passError) passError.classList.add('hidden');

            try {
                if (passNew.value !== passConfirm.value) {
                    throw new Error("New passwords do not match.");
                }

                if (submitBtn) submitBtn.disabled = true;
                if (submitBtn) submitBtn.textContent = 'Updating...';

                await authState.changePassword(passCurrent.value, passNew.value);

                if (passSuccess) passSuccess.classList.remove('hidden');
                (passwordForm as HTMLFormElement).reset();
            } catch (err: any) {
                if (passError) {
                    passError.textContent = err.message || 'Failed to update password.';
                    passError.classList.remove('hidden');
                }
            } finally {
                if (submitBtn) submitBtn.disabled = false;
                if (submitBtn) submitBtn.textContent = 'Update Password';
            }
        });
    }

    const deleteSelfAccountBtn = document.getElementById('delete-self-account-btn');
    if (deleteSelfAccountBtn) {
        deleteSelfAccountBtn.addEventListener('click', () => {
            const pwd = prompt("Please enter your password to confirm account deletion:");
            if (pwd) {
                deleteSelfAccountBtn.textContent = 'Deleting...';
                (deleteSelfAccountBtn as HTMLButtonElement).disabled = true;
                authState.deleteAccount(pwd).then(() => {
                    window.location.href = '/login.html';
                }).catch(err => {
                    alert(err.message || "Failed to delete account");
                    deleteSelfAccountBtn.textContent = 'Delete Account';
                    (deleteSelfAccountBtn as HTMLButtonElement).disabled = false;
                });
            }
        });
    }
}

export function initAccountModalHandlers() {
    const accountModal = document.getElementById('account-manager-modal');
    const accountBackdrop = document.getElementById('account-manager-backdrop');
    const closeAccountBtn = document.getElementById('close-account-modal-btn');
    const openAccountBtn = document.getElementById('open-account-manager-btn');
    const tabProfile = document.getElementById('tab-profile-settings');
    const tabPassword = document.getElementById('tab-password-settings');
    const paneProfile = document.getElementById('account-profile-pane');
    const panePassword = document.getElementById('account-password-pane');
    const profileSuccess = document.getElementById('profile-success');
    const profileError = document.getElementById('profile-error');
    const passSuccess = document.getElementById('password-success');
    const passError = document.getElementById('password-error');

    function closeAccountModal() {
        if (accountModal) accountModal.classList.add('hidden');
    }

    if (openAccountBtn) openAccountBtn.addEventListener('click', async () => {
        if (accountModal) accountModal.classList.remove('hidden');
        if (profileSuccess) profileSuccess.classList.add('hidden');
        if (profileError) profileError.classList.add('hidden');
        if (passSuccess) passSuccess.classList.add('hidden');
        if (passError) passError.classList.add('hidden');

        try {
            // Load user data to populate the form
            // @ts-ignore
            const { authState } = await import('../../auth');
            const userProfile = await authState.getProfile();

            const fnameEl = document.getElementById('profile-fname') as HTMLInputElement;
            const snameEl = document.getElementById('profile-sname') as HTMLInputElement;
            const pronounsEl = document.getElementById('profile-pronouns') as HTMLInputElement;
            const dietEl = document.getElementById('profile-dietary') as HTMLInputElement;
            const emergNameEl = document.getElementById('profile-emergency-name') as HTMLInputElement;
            const emergMobileEl = document.getElementById('profile-emergency-mobile') as HTMLInputElement;

            if (fnameEl) fnameEl.value = userProfile.firstName || '';
            if (snameEl) snameEl.value = userProfile.lastName || '';
            if (pronounsEl) pronounsEl.value = userProfile.pronouns || '';
            if (dietEl) dietEl.value = userProfile.dietaryRequirements || '';
            if (emergNameEl) emergNameEl.value = userProfile.emergencyContactName || '';
            if (emergMobileEl) emergMobileEl.value = userProfile.emergencyContactMobile || '';
        } catch (e) {
            console.error('Failed to pre-populate profile:', e);
        }
    });

    [closeAccountBtn, accountBackdrop].forEach(el => {
        if (el) el.addEventListener('click', closeAccountModal);
    });

    if (tabProfile && tabPassword && paneProfile && panePassword) {
        tabProfile.addEventListener('click', () => {
            paneProfile.classList.remove('hidden');
            panePassword.classList.add('hidden');
            tabProfile.classList.replace('text-slate-500', 'text-purple-400');
            tabProfile.classList.replace('border-transparent', 'border-purple-400');
            tabPassword.classList.replace('text-purple-400', 'text-slate-500');
            tabPassword.classList.replace('border-purple-400', 'border-transparent');
        });
        tabPassword.addEventListener('click', () => {
            panePassword.classList.remove('hidden');
            paneProfile.classList.add('hidden');
            tabPassword.classList.replace('text-slate-500', 'text-purple-400');
            tabPassword.classList.replace('border-transparent', 'border-purple-400');
            tabProfile.classList.replace('text-purple-400', 'text-slate-500');
            tabProfile.classList.replace('border-purple-400', 'border-transparent');
        });
    }
}
