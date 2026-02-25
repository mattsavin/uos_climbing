import './style.css';
import { authState } from './auth';

// Reusable components
const createNavbar = () => `
  <nav class="fixed w-full z-50 bg-brand-darker/80 backdrop-blur-lg border-b border-white/5 transition-all duration-300 transform" id="main-nav">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-20">
        <div class="flex-shrink-0">
          <a href="/" class="flex items-center gap-4">
            <img src="/climbing%20team%20logo.png" alt="USCC Logo" class="h-16 w-auto drop-shadow-md" />
            <div class="flex flex-col">
              <span class="text-2xl font-black tracking-tighter text-white leading-none">USCC</span>
              <span class="text-[0.6rem] font-bold tracking-widest text-brand-gold uppercase mt-1">Climbing Club</span>
            </div>
          </a>
        </div>
        <div class="hidden md:flex items-center space-x-8">
            <a href="/" class="nav-link">Home</a>
            <a href="/about.html" class="nav-link">About</a>
            <a href="/competitions.html" class="nav-link">Competitions</a>
            <a href="/join.html" class="nav-link">Join Us</a>
            <div class="flex items-center gap-4">
              <a href="/login.html" id="nav-auth-btn" class="text-sm font-bold text-slate-400 hover:text-brand-gold transition-colors uppercase tracking-wider px-4 py-2 border border-slate-700 hover:border-brand-gold/50 rounded-lg">
                Sign In
              </a>
            </div>
        </div>
        
        <!-- Mobile view: we only show the hamburger menu, hide the buttons inside -->
        <div class="-mr-2 flex items-center md:hidden">
          <button type="button" class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 focus:outline-none transition-colors" id="mobile-menu-btn-fallback">
            <span class="sr-only">Open main menu</span>
            <svg class="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Mobile menu -->
    <div class="md:hidden hidden bg-brand-darker border-b border-white/10" id="mobile-menu">
      <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3 flex flex-col items-center">
        <a href="/" class="block px-3 py-4 text-base font-medium text-white hover:text-brand-gold w-full text-center border-b border-white/5">Home</a>
        <a href="/about.html" class="block px-3 py-4 text-base font-medium text-white hover:text-brand-gold w-full text-center border-b border-white/5">About</a>
        <a href="/competitions.html" class="block px-3 py-4 text-base font-medium text-white hover:text-brand-gold w-full text-center border-b border-white/5">Competitions</a>
        <a href="/join.html" class="block px-3 py-4 text-base font-medium text-white hover:text-brand-gold w-full text-center">Join Us</a>
      </div>
    </div>
  </nav>
`;

const createFooter = () => `
  <footer class="bg-brand-darker border-t border-white/10 pt-16 pb-8 mt-24">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
        <div>
          <h3 class="text-2xl font-black text-white mb-4">USCC</h3>
          <p class="text-slate-400 max-w-sm">The University of Sheffield Climbing Club. Splintered for autonomy. Focused on indoor, competition, and reaching new heights.</p>
        </div>
        <div>
          <h4 class="text-lg font-bold text-white mb-4 uppercase tracking-wider">Quick Links</h4>
          <ul class="space-y-2">
            <li><a href="/about.html" class="text-slate-400 hover:text-brand-gold transition-colors">Origins & Committee</a></li>
            <li><a href="/competitions.html" class="text-slate-400 hover:text-brand-gold transition-colors">Team & Comps</a></li>
            <li><a href="/join.html" class="text-slate-400 hover:text-brand-gold transition-colors">Weekly Meets</a></li>
          </ul>
        </div>
        <div>
          <h4 class="text-lg font-bold text-white mb-4 uppercase tracking-wider">Connect</h4>
          <p class="text-slate-400 mb-2">Follow us to see our latest sends.</p>
          <a href="https://www.instagram.com/uos_climb/" target="_blank" rel="noopener noreferrer" class="inline-flex items-center text-brand-gold hover:text-brand-gold-muted transition-colors font-semibold">
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path fill-rule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clip-rule="evenodd" />
            </svg>
            @uos_climb
          </a>
        </div>
      </div>
      <div class="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center">
        <p class="text-slate-500 text-sm mb-4 md:mb-0">&copy; ${new Date().getFullYear()} University of Sheffield Climbing Club.</p>
        <p class="text-slate-500 text-sm">Forged in South Yorkshire.</p>
      </div>
    </div>
  </footer>
`;

// Initialize UI
export function initApp() {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) return;

  // Insert the navbar before the app container, and footer after it
  // This avoids wiping out the innerHTML and destroying React/Vanilla event listeners
  if (!document.getElementById('main-nav')) {
    app.insertAdjacentHTML('beforebegin', createNavbar());
  }

  if (!document.querySelector('footer')) {
    app.insertAdjacentHTML('afterend', createFooter());
  }

  app.classList.add('pt-20');

  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn-fallback');
  const mobileMenu = document.getElementById('mobile-menu');

  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }

  // Scroll effect on navbar
  const nav = document.getElementById('main-nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) {
        nav.classList.add('shadow-lg', 'bg-brand-darker/95');
        nav.classList.remove('bg-brand-darker/80');
      } else {
        nav.classList.remove('shadow-lg', 'bg-brand-darker/95');
        nav.classList.add('bg-brand-darker/80');
      }
    });
  }

  // Update navbar based on auth state
  authState.init().then(() => {
    const user = authState.getUser();
    const navAuthBtn = document.getElementById('nav-auth-btn') as HTMLAnchorElement;
    if (navAuthBtn) {
      if (user) {
        navAuthBtn.innerHTML = 'Dashboard';
        navAuthBtn.href = '/dashboard.html';
      } else {
        navAuthBtn.innerHTML = 'Sign In';
        navAuthBtn.href = '/login.html';
      }
    }
  });
}
