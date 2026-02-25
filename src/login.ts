import './style.css';
import { authState } from './auth';

export async function initLoginApp() {
    // If the user happens to hit this page while already logged in, redirect them
    await authState.init();
    if (authState.user) {
        window.location.href = '/dashboard.html';
        return;
    }

    const authGate = document.getElementById('auth-gate');

    const loginToggle = document.getElementById('toggle-login');
    const registerToggle = document.getElementById('toggle-register');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
    const loginError = document.getElementById('login-error');

    const registerBtn = document.getElementById('register-btn') as HTMLButtonElement;
    const registerError = document.getElementById('register-error');

    // Fade in layout
    setTimeout(() => {
        authGate?.classList.remove('opacity-0', 'translate-y-4');
    }, 100);

    // Form Toggles
    loginToggle?.addEventListener('click', () => {
        loginToggle.classList.add('text-brand-gold', 'border-brand-gold');
        loginToggle.classList.remove('text-slate-500', 'border-transparent', 'hover:text-white');

        registerToggle?.classList.remove('text-brand-gold', 'border-brand-gold');
        registerToggle?.classList.add('text-slate-500', 'border-transparent', 'hover:text-white');

        loginForm?.classList.remove('hidden');
        registerForm?.classList.add('hidden');
    });

    registerToggle?.addEventListener('click', () => {
        registerToggle.classList.add('text-brand-gold', 'border-brand-gold');
        registerToggle.classList.remove('text-slate-500', 'border-transparent', 'hover:text-white');

        loginToggle?.classList.remove('text-brand-gold', 'border-brand-gold');
        loginToggle?.classList.add('text-slate-500', 'border-transparent', 'hover:text-white');

        registerForm?.classList.remove('hidden');
        loginForm?.classList.add('hidden');
    });

    // Login Submission
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!loginError || !loginBtn) return;

        loginError.classList.add('hidden');
        loginBtn.disabled = true;
        loginBtn.textContent = 'Authenticating...';

        const email = (document.getElementById('login-email') as HTMLInputElement).value;
        const password = (document.getElementById('login-password') as HTMLInputElement).value;

        try {
            await authState.login(email, password);
            // On success, redirect to dashboard
            window.location.href = '/dashboard.html';
        } catch (error: any) {
            loginError.textContent = error.message || 'Login failed.';
            loginError.classList.remove('hidden');
            loginBtn.disabled = false;
            loginBtn.textContent = 'Access Portal';
        }
    });

    // Register Submission
    registerForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!registerError || !registerBtn) return;

        registerError.classList.add('hidden');
        registerBtn.disabled = true;
        registerBtn.textContent = 'Creating Account...';

        const firstName = (document.getElementById('reg-fname') as HTMLInputElement).value;
        const lastName = (document.getElementById('reg-sname') as HTMLInputElement).value;
        const email = (document.getElementById('reg-email') as HTMLInputElement).value;
        const registrationNumber = (document.getElementById('reg-regnum') as HTMLInputElement).value;
        const password = (document.getElementById('reg-password') as HTMLInputElement).value;

        try {
            await authState.register(
                firstName + ' ' + lastName,
                email,
                password,
                registrationNumber
            );
            // Auto login logic handled partially by auth state if we want, or do it explicitly:
            await authState.login(email, password);
            window.location.href = '/dashboard.html';
        } catch (error: any) {
            registerError.textContent = error.message || 'Registration failed.';
            registerError.classList.remove('hidden');
            registerBtn.disabled = false;
            registerBtn.textContent = 'Create Account';
        }
    });
}

// Call init when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoginApp);
} else {
    initLoginApp();
}
