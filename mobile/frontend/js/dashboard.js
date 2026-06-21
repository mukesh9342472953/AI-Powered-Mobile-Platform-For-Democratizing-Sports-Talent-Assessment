document.addEventListener("DOMContentLoaded", async () => {
    // Verify auth
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    renderBottomNav('dashboard');
    await loadDashboardData();
});

async function loadDashboardData() {
    const container = document.getElementById('dashboard-content');
    const headerName = document.getElementById('welcome-name');
    const roleBadge = document.getElementById('user-role-badge');
    
    // Loading State
    container.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; padding: 40px;">
            <div class="loader-ring" style="width: 40px; height: 40px; border-width: 4px;"></div>
        </div>
    `;

    try {
        const res = await apiFetch('/dashboard');
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.message || 'Failed to load dashboard');

        // Update Header
        headerName.textContent = `Hi, ${data.user.name}`;
        roleBadge.textContent = data.user.role.charAt(0).toUpperCase() + data.user.role.slice(1);
        roleBadge.className = `role-badge ${data.user.role}`;

        // Update Notification Dot in App Header
        const notifDot = document.getElementById('notif-dot');
        if (notifDot) {
            notifDot.style.display = data.notifications_count > 0 ? 'block' : 'none';
        }

        let html = '';

        // Upcoming Events Section (For All Users)
        if (data.upcoming_events && data.upcoming_events.length > 0) {
            html += `
                <div class="card" style="background: linear-gradient(145deg, rgba(59, 130, 246, 0.1), rgba(15, 23, 42, 0.8));">
                    <div class="card-title"><i data-lucide="calendar"></i> Upcoming Events</div>
            `;
            data.upcoming_events.forEach(ev => {
                const dateStr = new Date(ev.date).toLocaleDateString();
                html += `
                    <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; margin-bottom: 8px;">
                        <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${ev.title}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);"><i data-lucide="clock" style="width: 12px; height: 12px;"></i> ${dateStr}</div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        // Athlete Specific Dashboard
        if (data.user.role === 'athlete' && data.athlete_data) {
            const ath = data.athlete_data;
            
            // Stats / Assessments
            if (ath.latest_assessment) {
                const score = ath.latest_assessment.score || ath.latest_assessment.overall_score || 0;
                
                html += `
                    <div class="card" style="text-align: center; background: linear-gradient(145deg, rgba(16, 185, 129, 0.1), rgba(15, 23, 42, 0.8));">
                        <div style="font-size: 13px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Latest Talent Index</div>
                        <div style="font-size: 42px; font-weight: 800; color: var(--primary);">${score}<span style="font-size: 18px; color: var(--text-muted);">/100</span></div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">Total Assessments: <span style="color: white; font-weight: bold;">${ath.total_assessments}</span></div>
                        <a href="assessment.html" class="btn" style="margin-top: 16px; padding: 10px;">Upload New Video</a>
                    </div>
                `;

                // Skill Breakdown
                html += `
                    <div class="card">
                        <div class="card-title"><i data-lucide="activity"></i> Performance Metrics</div>
                        <div class="skill-grid">
                            <div class="skill-bar-card">
                                <div class="skill-bar-name">Speed</div>
                                <div class="skill-bar-value">${ath.latest_assessment.speed}%</div>
                                <div class="skill-bar-outer"><div class="skill-bar-inner blue" style="width: ${ath.latest_assessment.speed}%;"></div></div>
                            </div>
                            <div class="skill-bar-card">
                                <div class="skill-bar-name">Agility</div>
                                <div class="skill-bar-value">${ath.latest_assessment.agility}%</div>
                                <div class="skill-bar-outer"><div class="skill-bar-inner orange" style="width: ${ath.latest_assessment.agility}%;"></div></div>
                            </div>
                            <div class="skill-bar-card">
                                <div class="skill-bar-name">Fitness</div>
                                <div class="skill-bar-value">${ath.latest_assessment.fitness}%</div>
                                <div class="skill-bar-outer"><div class="skill-bar-inner" style="width: ${ath.latest_assessment.fitness}%;"></div></div>
                            </div>
                            <div class="skill-bar-card">
                                <div class="skill-bar-name">Balance</div>
                                <div class="skill-bar-value">${ath.latest_assessment.balance}%</div>
                                <div class="skill-bar-outer"><div class="skill-bar-inner purple" style="width: ${ath.latest_assessment.balance}%;"></div></div>
                            </div>
                            <div class="skill-bar-card" style="grid-column: span 2;">
                                <div class="skill-bar-name">Endurance</div>
                                <div class="skill-bar-value">${ath.latest_assessment.endurance}%</div>
                                <div class="skill-bar-outer"><div class="skill-bar-inner" style="background: var(--primary); width: ${ath.latest_assessment.endurance}%;"></div></div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="card" style="text-align: center; padding: 30px 20px;">
                        <i data-lucide="video" style="width: 40px; height: 40px; color: var(--text-muted); margin-bottom: 12px;"></i>
                        <h3 style="margin-bottom: 8px;">No Assessments Yet</h3>
                        <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 20px;">Upload a video to get your AI-powered talent index and skill breakdown.</p>
                        <a href="assessment.html" class="btn">Start Assessment</a>
                    </div>
                `;
            }

            // Fitness Goals
            html += `
                <div class="card">
                    <div class="card-title"><i data-lucide="flame"></i> Fitness Goals</div>
            `;
            if (ath.fitness_goals && ath.fitness_goals.length > 0) {
                ath.fitness_goals.forEach(g => {
                    html += `
                        <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-size: 14px; font-weight: 600; text-transform: capitalize;">${g.goal_type}</div>
                                <div style="font-size: 12px; color: var(--text-secondary);">Target: ${g.target_value}</div>
                            </div>
                            <span style="color: var(--text-muted); font-size: 12px;">In Progress</span>
                        </div>
                    `;
                });
            } else {
                html += `<p style="font-size: 13px; color: var(--text-secondary);">No active goals currently set.</p>`;
            }
            html += `</div>`;
        }

        if (data.user.role !== 'athlete') {
            html += `
                <div class="card" style="text-align: center; padding: 30px 20px;">
                    <i data-lucide="layout-dashboard" style="width: 40px; height: 40px; color: var(--text-muted); margin-bottom: 12px;"></i>
                    <h3 style="margin-bottom: 8px;">Welcome to your Portal</h3>
                    <p style="color: var(--text-secondary); font-size: 13px;">Your specific tools (Search, Review, Manage) are available in the navigation bar below.</p>
                </div>
            `;
        }

        // Quick Actions (All Roles)
        html += `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                <a href="leaderboard.html" class="btn btn-secondary" style="text-decoration: none;">
                    <i data-lucide="trophy"></i> Rankings
                </a>
                <a href="events.html" class="btn btn-secondary" style="text-decoration: none;">
                    <i data-lucide="calendar"></i> Events
                </a>
            </div>
        `;

        container.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (err) {
        container.innerHTML = `
            <div class="alert alert-error" style="margin-top: 20px;">
                <i data-lucide="alert-circle"></i>
                <div>Failed to load dashboard data. Please try again.</div>
            </div>
            <button onclick="loadDashboardData()" class="btn btn-secondary" style="margin: 0 auto; display: block; width: fit-content;">Retry</button>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}
