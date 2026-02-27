import { authState, committeeApi } from '../../auth';
import { showToast } from '../../utils';

export function initCommitteeProfileHandlers() {
    const committeeProfileCard = document.getElementById('committee-profile-card');
    const profilePhotoInput = document.getElementById('profile-photo-input') as HTMLInputElement;
    const uploadPhotoBtn = document.getElementById('upload-photo-btn');
    const profilePreview = document.getElementById('profile-preview') as HTMLImageElement;
    const profilePlaceholder = document.getElementById('profile-placeholder');
    const instagramInput = document.getElementById('comm-instagram') as HTMLInputElement;
    const faveCragInput = document.getElementById('comm-fave-crag') as HTMLInputElement;
    const bioInput = document.getElementById('comm-bio') as HTMLTextAreaElement;
    const saveBtn = document.getElementById('save-comm-profile-btn');

    if (!committeeProfileCard) return;
    const committeeProfileCardEl = committeeProfileCard as HTMLElement;

    function isCommitteeUser(user: any) {
        return !!user && (
            user.role === 'committee'
            || !!user.committeeRole
            || (Array.isArray(user.committeeRoles) && user.committeeRoles.length > 0)
        );
    }

    function refreshCardVisibilityAndData() {
        const user = authState.getUser();
        if (isCommitteeUser(user)) {
            committeeProfileCardEl.classList.remove('hidden');
            populateCommitteeFields();
            return;
        }
        committeeProfileCardEl.classList.add('hidden');
    }

    // Initial pass (may run before auth init finishes)
    refreshCardVisibilityAndData();
    // Re-run after dashboard/auth state updates
    window.addEventListener('dashboardUpdate', refreshCardVisibilityAndData);

    async function populateCommitteeFields() {
        const user = authState.getUser();
        if (!user) return;

        // Populate existing values
        if (instagramInput) instagramInput.value = user.instagram || '';
        if (faveCragInput) faveCragInput.value = user.faveCrag || '';
        if (bioInput) bioInput.value = user.bio || '';

        if (user.profilePhoto) {
            if (profilePreview) {
                profilePreview.src = user.profilePhoto;
                profilePreview.classList.remove('hidden');
            }
            if (profilePlaceholder) profilePlaceholder.classList.add('hidden');
        }
    }

    // Photo Upload Handlers
    if (uploadPhotoBtn && profilePhotoInput) {
        uploadPhotoBtn.addEventListener('click', () => profilePhotoInput.click());

        profilePhotoInput.addEventListener('change', async () => {
            const file = profilePhotoInput.files?.[0];
            if (!file) return;

            // Preview locally first
            const reader = new FileReader();
            reader.onload = (e) => {
                if (profilePreview && e.target?.result) {
                    profilePreview.src = e.target.result as string;
                    profilePreview.classList.remove('hidden');
                    if (profilePlaceholder) profilePlaceholder.classList.add('hidden');
                }
            };
            reader.readAsDataURL(file);

            // Upload to server
            try {
                uploadPhotoBtn.textContent = 'Uploading...';
                const result = await committeeApi.uploadPhoto(file);
                showToast('Profile photo updated!', 'success');

                // Update local user state
                const user = authState.getUser();
                if (user) user.profilePhoto = result.photoPath;
            } catch (err: any) {
                showToast(err.message || 'Failed to upload photo', 'error');
            } finally {
                uploadPhotoBtn.textContent = 'Change Photo';
            }
        });
    }

    // Profile Save Handler
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const profile = {
                instagram: instagramInput.value.trim(),
                faveCrag: faveCragInput.value.trim(),
                bio: bioInput.value.trim()
            };

            try {
                saveBtn.textContent = 'Saving...';
                (saveBtn as HTMLButtonElement).disabled = true;

                await committeeApi.updateMyProfile(profile);
                showToast('Committee profile updated!', 'success');

                // Update local user state
                const user = authState.getUser();
                if (user) {
                    user.instagram = profile.instagram;
                    user.faveCrag = profile.faveCrag;
                    user.bio = profile.bio;
                }
            } catch (err: any) {
                showToast(err.message || 'Failed to update profile', 'error');
            } finally {
                saveBtn.textContent = 'Save Profile';
                (saveBtn as HTMLButtonElement).disabled = false;
            }
        });
    }
}
