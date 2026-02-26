import './style.css';
import { authState, votingApi, adminApi } from './auth';
import { initApp } from './main';
import { escapeHTML, showToast, showConfirmModal } from './utils';
import { config } from './config';

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

    // Referendum elements
    const referendumsList = document.getElementById('referendums-list');
    const addReferendumForm = document.getElementById('add-referendum-form') as HTMLFormElement;
    const resetElectionsBtn = document.getElementById('reset-elections-btn');

    async function initElections() {
        const user = authState.getUser();

        const yearSpan = document.getElementById('election-year');
        if (yearSpan) yearSpan.textContent = config.academicYear;

        if (candidateRole) {
            candidateRole.innerHTML = '<option value="" disabled selected>Select a role...</option>' +
                config.committeeRoles.map((r: any) => `<option value="${r.title}">${r.title}</option>`).join('');
        }

        if (!user) {
            window.location.href = '/login.html';
            return;
        }

        // Render Navbar based on auth state (Optional/Abstracted elsewhere but assuming index.html's logic)
        // Check global elections config
        try {
            const isAdmin = user.role === 'committee' || !!user.committeeRole || (Array.isArray(user.committeeRoles) && user.committeeRoles.length > 0);

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
                            showToast(err.message || 'Failed to update elections setting.', 'error');
                            toggleElectionsOpen.checked = !open;
                        } finally {
                            toggleElectionsOpen.disabled = false;
                        }
                    });
                }

                if (resetElectionsBtn) {
                    resetElectionsBtn.addEventListener('click', async () => {
                        const confirmed = await showConfirmModal('Are you sure you want to reset the election cycle? This wipes all candidates, votes, and referendums. This cannot be undone.');
                        if (confirmed) {
                            try {
                                await votingApi.resetElections();
                                showToast('Election cycle cleared successfully.', 'success');
                                if (toggleElectionsOpen) toggleElectionsOpen.checked = false;
                                await renderVotingPortal();
                            } catch (err: any) {
                                showToast(err.message || 'Error resetting elections', 'error');
                            }
                        }
                    });
                }

                if (addReferendumForm) {
                    addReferendumForm.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const title = (document.getElementById('referendum-title') as HTMLInputElement).value;
                        const desc = (document.getElementById('referendum-description') as HTMLTextAreaElement).value;
                        if (!title || !desc) return;

                        const submitBtn = addReferendumForm.querySelector('button[type="submit"]') as HTMLButtonElement;
                        try {
                            submitBtn.disabled = true;
                            submitBtn.textContent = 'Publishing...';
                            await votingApi.createReferendum(title, desc);
                            addReferendumForm.reset();
                            await renderVotingPortal();
                            showToast('Referendum published.', 'success');
                        } catch (err: any) {
                            showToast(err.message || 'Failed to add referendum', 'error');
                        } finally {
                            submitBtn.disabled = false;
                            submitBtn.textContent = 'Publish Referendum';
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
            const referendums = await votingApi.getReferendums();

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
                if (myCandidateStatus) {
                    myCandidateStatus.classList.remove('hidden');

                    // Clear previous withdraw button if exists to prevent duplicates
                    const oldWithdraw = myCandidateStatus.querySelector('#withdraw-candidate-btn');
                    if (oldWithdraw) oldWithdraw.remove();

                    // Append withdraw button
                    const withdrawBtn = document.createElement('button');
                    withdrawBtn.id = 'withdraw-candidate-btn';
                    withdrawBtn.className = 'mt-3 text-xs font-bold text-red-400 hover:text-red-300 underline decoration-dashed transition-colors uppercase tracking-wider block';
                    withdrawBtn.textContent = 'Withdraw Candidacy';
                    withdrawBtn.onclick = async () => {
                        const confirmed = await showConfirmModal('Are you sure you want to withdraw your candidacy? This action cannot be undone.');
                        if (confirmed) {
                            try {
                                withdrawBtn.disabled = true;
                                withdrawBtn.textContent = 'Withdrawing...';
                                await votingApi.withdrawCandidate();
                                await renderVotingPortal(); // Refresh the UI
                            } catch (err: any) {
                                showToast(err.message || 'Failed to withdraw candidacy', 'error');
                                withdrawBtn.disabled = false;
                                withdrawBtn.textContent = 'Withdraw Candidacy';
                            }
                        }
                    };
                    myCandidateStatus.appendChild(withdrawBtn);
                }
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
                <div class="glass-card text-center p-8 border border-white/5">
                    <p class="text-slate-400">No candidates have applied yet.</p>
                    <p class="text-xs text-slate-500 mt-2">Be the first to step up and run for committee!</p>
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

                const rolesOrder = config.committeeRoles.map((r: any) => r.title);

                let listHtml = '';

                // Render in specific order
                for (const role of rolesOrder) {
                    const roleCandidates = grouped[role];
                    if (roleCandidates && roleCandidates.length > 0) {
                        listHtml += `
            <div class="mb-8">
                <h3 class="text-lg font-black text-brand-gold mb-4 uppercase tracking-wider pl-2 border-l-4 border-brand-gold/50">${role}</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        `;

                        listHtml += roleCandidates.map(c => {
                            const safeName = escapeHTML(c.name);
                            const safeManifesto = escapeHTML(c.manifesto);
                            const safeLink = c.presentationLink ? escapeHTML(c.presentationLink) : '';

                            const slideBadge = safeLink ? `
                                <a href="${safeLink}" target="_blank" rel="noopener noreferrer" class="absolute top-4 right-20 text-[10px] uppercase font-bold px-2 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded flex items-center gap-1 hover:bg-blue-500/40 transition-colors">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                    Slides
                                </a>
                            ` : '';

                            const mainBtn = !status.hasVoted && !status.isCandidate ? `
                                <button class="btn-outline w-full !py-2 !text-xs !border-purple-400 !text-purple-400 hover:!bg-purple-400 hover:!text-white vote-btn transition-colors mt-auto" data-id="${c.id}" data-name="${safeName}">
                                    Vote for ${safeName.split(' ')[0]}
                                </button>
                            ` : '';

                            return `
                            <div class="glass-card !p-5 border border-white/5 relative group flex flex-col h-full bg-slate-800/20 hover:bg-slate-800/40 transition-colors">
                                <div class="absolute top-4 right-4 text-xs font-bold px-2 py-1 bg-brand-gold-muted/20 text-brand-gold-muted rounded-full">
                                    ${c.voteCount} Votes
                                </div>
                                ${slideBadge}
                                <h5 class="text-white text-lg font-bold mb-3 pr-24">${safeName}</h5>
                                <p class="text-sm text-slate-300 mb-6 whitespace-pre-wrap leading-relaxed flex-grow">${safeManifesto}</p>
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
                            if (id) {
                                const confirmed = await showConfirmModal(`Are you sure you want to cast your final vote for ${name}? You CANNOT change this later.`);
                                if (confirmed) {
                                    try {
                                        (e.currentTarget as HTMLButtonElement).disabled = true;
                                        (e.currentTarget as HTMLButtonElement).textContent = 'Voting...';
                                        await votingApi.castVote(id);
                                        await renderVotingPortal();

                                        // Optional: Confetti or success animation here
                                    } catch (err: any) {
                                        showToast(err.message || 'Failed to cast vote.', 'error');
                                        (e.currentTarget as HTMLButtonElement).disabled = false;
                                    }
                                }
                            }
                        });
                    });
                }

                // Render Referendums
                if (referendumsList) {
                    if (referendums.length === 0) {
                        referendumsList.innerHTML = `
                            <div class="glass-card text-center p-8 border border-white/5">
                                <p class="text-slate-400">No referendums are currently active.</p>
                            </div>
                        `;
                    } else {
                        const user = authState.getUser();
                        const isAdmin = user && (user.role === 'committee' || !!user.committeeRole || (Array.isArray(user.committeeRoles) && user.committeeRoles.length > 0));

                        referendumsList.innerHTML = referendums.map(ref => {
                            const safeTitle = escapeHTML(ref.title);
                            const safeDesc = escapeHTML(ref.description);

                            // Delete button for admins
                            const adminControls = isAdmin ? `
                                <button class="delete-ref-btn absolute top-4 right-4 text-red-400/50 hover:text-red-400 transition-colors" data-id="${ref.id}" title="Delete Referendum">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            ` : '';

                            // Voting controls or Results
                            let interactiveSection = '';

                            if (ref.myVote) {
                                // User has voted, show results and their vote
                                interactiveSection = `
                                    <div class="mt-4 pt-4 border-t border-white/10">
                                        <p class="text-xs text-brand-gold font-bold mb-3 uppercase tracking-wider">Results (You voted: ${ref.myVote.toUpperCase()})</p>
                                        <div class="flex gap-4 text-sm font-medium">
                                            <div class="text-emerald-400 flex-1 bg-emerald-400/10 rounded px-3 py-2 text-center border border-emerald-400/20">For: ${ref.yesCount}</div>
                                            <div class="text-red-400 flex-1 bg-red-400/10 rounded px-3 py-2 text-center border border-red-400/20">Against: ${ref.noCount}</div>
                                            <div class="text-slate-400 flex-1 bg-slate-400/10 rounded px-3 py-2 text-center border border-slate-400/20">Abstain: ${ref.abstainCount}</div>
                                        </div>
                                    </div>
                                `;
                            } else if (isAdmin) {
                                // Admin viewing results without voting themselves (or admin who hasn't voted yet)
                                interactiveSection = `
                                    <div class="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row gap-4">
                                        <div class="flex-1 flex gap-2">
                                            <button class="vote-ref-btn btn-outline flex-1 !py-2 !text-xs !border-emerald-500/50 !text-emerald-400 hover:!bg-emerald-500 hover:!text-white" data-id="${ref.id}" data-choice="yes">Vote For</button>
                                            <button class="vote-ref-btn btn-outline flex-1 !py-2 !text-xs !border-red-500/50 !text-red-400 hover:!bg-red-500 hover:!text-white" data-id="${ref.id}" data-choice="no">Vote Against</button>
                                            <button class="vote-ref-btn btn-outline flex-1 !py-2 !text-xs !border-slate-500/50 !text-slate-400 hover:!bg-slate-500 hover:!text-white" data-id="${ref.id}" data-choice="abstain">Abstain</button>
                                        </div>
                                        <div class="sm:w-32 text-right">
                                            <p class="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Current Standings</p>
                                            <div class="text-xs text-slate-300 font-mono">${ref.yesCount} Y / ${ref.noCount} N / ${ref.abstainCount} A</div>
                                        </div>
                                    </div>
                                `;
                            } else {
                                // Regular user who hasn't voted yet
                                interactiveSection = `
                                    <div class="mt-4 pt-4 border-t border-white/10 flex gap-2">
                                        <button class="vote-ref-btn btn-outline flex-1 !py-2 !text-xs !border-emerald-500/50 !text-emerald-400 hover:!bg-emerald-500 hover:!text-white" data-id="${ref.id}" data-choice="yes">Vote For</button>
                                        <button class="vote-ref-btn btn-outline flex-1 !py-2 !text-xs !border-red-500/50 !text-red-400 hover:!bg-red-500 hover:!text-white" data-id="${ref.id}" data-choice="no">Vote Against</button>
                                        <button class="vote-ref-btn btn-outline flex-1 !py-2 !text-xs !border-slate-500/50 !text-slate-400 hover:!bg-slate-500 hover:!text-white" data-id="${ref.id}" data-choice="abstain">Abstain</button>
                                    </div>
                                `;
                            }

                            return `
                                <div class="glass-card !p-6 border border-white/5 relative bg-slate-800/20">
                                    ${adminControls}
                                    <h3 class="text-lg font-bold text-white mb-2 pr-8">${safeTitle}</h3>
                                    <p class="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">${safeDesc}</p>
                                    ${interactiveSection}
                                </div>
                            `;
                        }).join('');

                        // Attach referendum event listeners
                        if (isAdmin) {
                            document.querySelectorAll('.delete-ref-btn').forEach(btn => {
                                btn.addEventListener('click', async (e) => {
                                    const id = (e.currentTarget as HTMLElement).dataset.id;
                                    if (id) {
                                        const confirmed = await showConfirmModal('Delete this referendum? All associated votes will be lost.');
                                        if (confirmed) {
                                            try {
                                                await votingApi.deleteReferendum(id);
                                                await renderVotingPortal();
                                                showToast('Referendum deleted', 'success');
                                            } catch (err: any) {
                                                showToast(err.message || 'Failed to delete referendum', 'error');
                                            }
                                        }
                                    }
                                });
                            });
                        }

                        document.querySelectorAll('.vote-ref-btn').forEach(btn => {
                            btn.addEventListener('click', async (e) => {
                                const btnEl = e.currentTarget as HTMLButtonElement;
                                const id = btnEl.dataset.id;
                                const choice = btnEl.dataset.choice as 'yes' | 'no' | 'abstain';

                                if (id && choice) {
                                    const labels = { 'yes': 'FOR', 'no': 'AGAINST', 'abstain': 'to ABSTAIN on' };
                                    const confirmed = await showConfirmModal(`Are you sure you want to vote ${labels[choice]} this referendum? You CANNOT change this later.`);

                                    if (confirmed) {
                                        try {
                                            btnEl.disabled = true;
                                            btnEl.textContent = 'Voting...';
                                            await votingApi.voteReferendum(id, choice);
                                            await renderVotingPortal();
                                            showToast('Vote cast successfully', 'success');
                                        } catch (err: any) {
                                            showToast(err.message || 'Failed to cast vote', 'error');
                                            btnEl.disabled = false;
                                        }
                                    }
                                }
                            });
                        });
                    }
                }
            }
        } catch (err: any) {
            console.error("Voting portal error:", err);
            if (candidatesList) candidatesList.innerHTML = `<p class="text-sm text-red-500 text-center py-4">Failed to load elections data: ${err.message}</p>`;
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
