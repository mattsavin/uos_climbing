import './style.css';
import { authState, votingApi, adminApi } from './auth';
import { initApp } from './main';

document.addEventListener('DOMContentLoaded', () => {

    const portal = document.getElementById('elections-portal');
    const closedMessage = document.getElementById('voting-closed-message');
    const globalStatusSpan = document.getElementById('global-voting-status');
    const adminPanel = document.getElementById('elections-admin-panel');
    const toggleElectionsOpen = document.getElementById('toggle-elections-open') as HTMLInputElement;

    const myCandidateStatus = document.getElementById('my-candidate-status');
    const myCandidateRoleBadge = document.getElementById('my-candidate-role-badge');
    const myVoteStatus = document.getElementById('my-vote-status');
    const candidateApplySection = document.getElementById('candidate-apply-section');

    const applyCandidateForm = document.getElementById('apply-candidate-form') as HTMLFormElement;
    const applyCandidateError = document.getElementById('apply-candidate-error');
    const candidateRole = document.getElementById('candidate-role') as HTMLSelectElement;
    const candidateManifesto = document.getElementById('candidate-manifesto') as HTMLTextAreaElement;
    const candidatePresentation = document.getElementById('candidate-presentation') as HTMLInputElement;

    const candidatesList = document.getElementById('candidates-list');

    async function initElections() {
        const user = authState.getUser();

        if (!user) {
            window.location.href = '/login.html';
            return;
        }

        // Render Navbar based on auth state (Optional/Abstracted elsewhere but assuming index.html's logic)
        // Check global elections config
        try {
            const isAdmin = user.role === 'committee';

            // Check if admin panel should be visible
            if (isAdmin) {
                if (adminPanel) adminPanel.classList.remove('hidden');

                // Fetch the actual config override logic explicitly from admin API
                const config = await adminApi.getElectionsConfig();
                if (toggleElectionsOpen) {
                    toggleElectionsOpen.checked = config.electionsOpen;
                    toggleElectionsOpen.addEventListener('change', async (e) => {
                        const open = (e.target as HTMLInputElement).checked;
                        try {
                            toggleElectionsOpen.disabled = true;
                            await adminApi.setElectionsConfig(open);
                            await renderVotingPortal();
                        } catch (err: any) {
                            alert(err.message || 'Failed to update elections setting.');
                            toggleElectionsOpen.checked = !open;
                        } finally {
                            toggleElectionsOpen.disabled = false;
                        }
                    });
                }
            } else {
                if (adminPanel) adminPanel.classList.add('hidden');
            }

            await renderVotingPortal();

        } catch (err: any) {
            console.error("Failed to initialize elections data", err);
            if (globalStatusSpan) {
                globalStatusSpan.textContent = "Error Loading Elections";
                globalStatusSpan.classList.add('text-red-400', 'border-red-400');
            }
        }
    }

    async function renderVotingPortal() {
        if (!candidatesList) return;

        try {
            const status = await votingApi.getStatus();
            const candidates = await votingApi.getCandidates();

            // Set Global status UI
            if (globalStatusSpan) {
                globalStatusSpan.textContent = status.electionsOpen ? 'Open for Voting' : 'Closed';
                globalStatusSpan.className = status.electionsOpen ?
                    'px-4 py-2 rounded-lg font-bold tracking-widest uppercase text-sm border bg-brand-gold/10 border-brand-gold/50 text-brand-gold' :
                    'px-4 py-2 rounded-lg font-bold tracking-widest uppercase text-sm border bg-red-400/10 border-red-400/50 text-red-400';
            }

            if (!status.electionsOpen) {
                // Hide portal, show closed message
                if (portal) portal.classList.add('hidden');
                if (closedMessage) closedMessage.classList.remove('hidden');
                return; // stop rendering internal portal state
            } else {
                if (portal) portal.classList.remove('hidden');
                if (closedMessage) closedMessage.classList.add('hidden');
            }

            // Handle forms & personal status boxes visibility when Open
            if (status.isCandidate) {
                if (candidateApplySection) candidateApplySection.classList.add('hidden');
                if (myCandidateStatus) myCandidateStatus.classList.remove('hidden');
                if (myCandidateRoleBadge) myCandidateRoleBadge.textContent = `Running for: ${status.candidateRole} `;
            } else {
                if (candidateApplySection) candidateApplySection.classList.remove('hidden');
                if (myCandidateStatus) myCandidateStatus.classList.add('hidden');
            }

            if (status.hasVoted) {
                if (myVoteStatus) myVoteStatus.classList.remove('hidden');
            } else {
                if (myVoteStatus) myVoteStatus.classList.add('hidden');
            }

            // Group Candidates by Role
            if (candidates.length === 0) {
                candidatesList.innerHTML = `
    < div class="glass-card text-center p-8 border border-white/5" >
        <p class="text-slate-400" > No candidates have applied yet.</p>
            < p class="text-xs text-slate-500 mt-2" > Be the first to step up and run for committee! </p>
                </div>
                    `;
            } else {
                const grouped = candidates.reduce((acc, candidate) => {
                    if (!acc[candidate.role]) {
                        acc[candidate.role] = [];
                    }
                    acc[candidate.role].push(candidate);
                    return acc;
                }, {} as Record<string, typeof candidates>);

                const rolesOrder = [
                    'Chair', 'Secretary', 'Treasurer', 'Welfare & Inclusions',
                    'Team Captain', "Women's Captain", "Men's Captain",
                    'Social Sec', 'Publicity', 'Kit & Safety Sec'
                ];

                let listHtml = '';

                // Render in specific order
                for (const role of rolesOrder) {
                    const roleCandidates = grouped[role];
                    if (roleCandidates && roleCandidates.length > 0) {
                        listHtml += `
                < div class= "mb-8" >
                <h3 class= "text-lg font-black text-brand-gold mb-4 uppercase tracking-wider pl-2 border-l-4 border-brand-gold/50" > ${role} </h3>
                    < div class="grid grid-cols-1 md:grid-cols-2 gap-4" >
                        `;

                        listHtml += roleCandidates.map(c => {
                            const slideBadge = c.presentationLink ? `
                        < a href = "${c.presentationLink}" target = "_blank" rel = "noopener noreferrer" class="absolute top-4 right-20 text-[10px] uppercase font-bold px-2 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded flex items-center gap-1 hover:bg-blue-500/40 transition-colors" >
                            <svg class="w-3 h-3" fill = "none" stroke = "currentColor" viewBox = "0 0 24 24" > <path stroke - linecap="round" stroke - linejoin="round" stroke - width="2" d = "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" > </path></svg >
                                Slides
                                </a>
                                    ` : '';

                            const mainBtn = !status.hasVoted && !status.isCandidate ? `
                                < button class="btn-outline w-full !py-2 !text-xs !border-purple-400 !text-purple-400 hover:!bg-purple-400 hover:!text-white vote-btn transition-colors mt-auto" data - id="${c.id}" data - name="${c.name}" >
                                    Vote for ${c.name.split(' ')[0]}
                                        </button>
                                            ` : '';

                            return `
                                        < div class= "glass-card !p-5 border border-white/5 relative group flex flex-col h-full bg-slate-800/20 hover:bg-slate-800/40 transition-colors" >
                                        <div class= "absolute top-4 right-4 text-xs font-bold px-2 py-1 bg-brand-gold-muted/20 text-brand-gold-muted rounded-full" >
                                            ${c.voteCount} Votes
                                                </div>
                                ${slideBadge}
<h5 class="text-white text-lg font-bold mb-3 pr-24" > ${c.name} </h5>
    < p class="text-sm text-slate-300 mb-6 whitespace-pre-wrap leading-relaxed flex-grow" > ${c.manifesto} </p>
                                ${mainBtn}
</div>
    `;
                        }).join('');

                        listHtml += `
    </div>
    </div>
        `;
                    }
                }

                candidatesList.innerHTML = listHtml;

                // Attach vote listeners
                if (!status.hasVoted && !status.isCandidate) {
                    document.querySelectorAll('.vote-btn').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            const id = (e.currentTarget as HTMLElement).dataset.id;
                            const name = (e.currentTarget as HTMLElement).dataset.name;
                            if (id && confirm(`Are you sure you want to cast your final vote for ${name} ? You CANNOT change this later.`)) {
                                try {
                                    (e.currentTarget as HTMLButtonElement).disabled = true;
                                    (e.currentTarget as HTMLButtonElement).textContent = 'Voting...';
                                    await votingApi.castVote(id);
                                    await renderVotingPortal();

                                    // Optional: Confetti or success animation here
                                } catch (err: any) {
                                    alert(err.message || 'Failed to cast vote.');
                                    (e.currentTarget as HTMLButtonElement).disabled = false;
                                }
                            }
                        });
                    });
                }
            }
        } catch (err: any) {
            console.error("Voting portal error:", err);
            if (candidatesList) candidatesList.innerHTML = `< p class="text-sm text-red-500 text-center py-4" > Failed to load elections data: ${err.message} </p>`;
        }
    }

    if (applyCandidateForm) {
        applyCandidateForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const role = candidateRole.value;
            const manifesto = candidateManifesto.value.trim();
            const presentationUrl = candidatePresentation.value.trim();

            if (!role || !manifesto) return;

            const submitBtn = applyCandidateForm.querySelector('button[type="submit"]') as HTMLButtonElement | null;
            if (applyCandidateError) applyCandidateError.classList.add('hidden');

            try {
                if (submitBtn) submitBtn.disabled = true;
                if (submitBtn) submitBtn.textContent = 'Submitting...';

                await votingApi.applyCandidate(manifesto, role, presentationUrl || undefined);
                applyCandidateForm.reset();
                await renderVotingPortal();
            } catch (err: any) {
                if (applyCandidateError) {
                    applyCandidateError.textContent = err.message || 'Failed to submit manifesto.';
                    applyCandidateError.classList.remove('hidden');
                }
            } finally {
                if (submitBtn) submitBtn.disabled = false;
                if (submitBtn) submitBtn.textContent = 'Submit Application';
            }
        });
    }

    // Initial Boot
    authState.init().then(() => {
        initApp();
        initElections();
    });
});
