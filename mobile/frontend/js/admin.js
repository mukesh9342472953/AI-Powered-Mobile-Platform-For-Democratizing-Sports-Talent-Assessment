document.addEventListener("DOMContentLoaded", async () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    const user = JSON.parse(userStr);

    document.getElementById('welcome-name').textContent = `Hi, ${user.name}`;

    await loadAnalytics();
    await loadUsers();
    await loadEvents();
    await loadAssessments();
});

function switchTab(tabId) {
    document.querySelectorAll('.admin-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-tab-btn').forEach(el => el.classList.remove('active'));

    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.getElementById(`btn-tab-${tabId}`).classList.add('active');
}

async function loadAnalytics() {
    try {
        const res = await apiFetch('/admin/analytics');
        const stats = await res.json();
        
        document.getElementById('stat-users').textContent = stats.totalUsers || 0;
        document.getElementById('stat-athletes').textContent = stats.totalAthletes || 0;
        document.getElementById('stat-coaches').textContent = stats.totalCoaches || 0;
        document.getElementById('stat-recruiters').textContent = stats.totalRecruiters || 0;
        document.getElementById('stat-events').textContent = stats.totalEvents || 0;
        document.getElementById('stat-assessments').textContent = stats.totalAssessments || 0;
    } catch(e) {
        console.error('Failed to load analytics');
    }
}

async function loadUsers() {
    const tbody = document.getElementById('table-users');
    try {
        const res = await apiFetch('/admin/users');
        const users = await res.json();

        let html = '';
        users.forEach(u => {
            html += `
                <tr>
                    <td>
                        <div style="font-weight: 600;">${u.name}</div>
                        <div style="font-size: 11px; color: var(--text-muted);">${u.email}</div>
                    </td>
                    <td><span class="role-badge ${u.role}" style="font-size: 10px; padding: 2px 6px;">${u.role}</span></td>
                    <td style="text-align: right;">
                        <button onclick="adminToggleStatus(${u.id})" style="background:none; border:none; color: var(--text-secondary); cursor: pointer; padding: 4px;" title="Toggle Status"><i data-lucide="power" style="width: 14px; height: 14px;"></i></button>
                        <button onclick="adminResetPassword(${u.id})" style="background:none; border:none; color: var(--primary); cursor: pointer; padding: 4px;" title="Reset Password"><i data-lucide="key" style="width: 14px; height: 14px;"></i></button>
                        <button onclick="adminDeleteUser(${u.id})" style="background:none; border:none; color: #f87171; cursor: pointer; padding: 4px;" title="Delete User"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i></button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html || '<tr><td colspan="3">No users found.</td></tr>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="3" style="color:#f87171;">Failed to load</td></tr>';
    }
}

async function loadEvents() {
    const tbody = document.getElementById('table-events');
    try {
        const res = await apiFetch('/admin/events');
        const events = await res.json();

        let html = '';
        events.forEach(e => {
            html += `
                <tr>
                    <td>
                        <div style="font-weight: 600;">${e.title}</div>
                        <div style="font-size: 11px; color: var(--text-muted);">${e.venue}</div>
                    </td>
                    <td style="font-size: 12px; color: var(--text-secondary);">${new Date(e.date).toLocaleDateString()}</td>
                    <td style="text-align: right;">
                        <button onclick="adminDeleteEvent(${e.id})" style="background:none; border:none; color: #f87171; cursor: pointer; padding: 4px;" title="Delete Event"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i></button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html || '<tr><td colspan="3">No events found.</td></tr>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="3" style="color:#f87171;">Failed to load</td></tr>';
    }
}

async function loadAssessments() {
    const tbody = document.getElementById('table-assessments');
    try {
        const res = await apiFetch('/admin/assessments');
        const data = await res.json();

        let html = '';
        data.forEach(a => {
            html += `
                <tr>
                    <td>
                        <div style="font-weight: 600;">${a.athlete_name}</div>
                        <div style="font-size: 11px; color: var(--text-muted);">${a.sport}</div>
                    </td>
                    <td style="font-size: 14px; font-weight: 700; color: var(--primary);">${a.score}</td>
                    <td style="text-align: right;">
                        <button onclick="adminDeleteAssessment(${a.id})" style="background:none; border:none; color: #f87171; cursor: pointer; padding: 4px;" title="Delete Assessment"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i></button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html || '<tr><td colspan="3">No assessments found.</td></tr>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="3" style="color:#f87171;">Failed to load</td></tr>';
    }
}

/* Actions */
async function adminToggleStatus(userId) {
    if(!confirm("Are you sure you want to toggle this user's access?")) return;
    try {
        const status = prompt("Type 'active' to enable or 'disabled' to disable:", "disabled");
        if (status !== 'active' && status !== 'disabled') return;

        const res = await apiFetch(`/admin/users/${userId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        if (res.ok) {
            loadUsers();
        } else {
            alert('Error updating status');
        }
    } catch(e) { alert('Connection error'); }
}

async function adminResetPassword(userId) {
    const newPass = prompt("Enter a new password for this user (min 6 characters):");
    if (!newPass || newPass.length < 6) return alert("Password must be at least 6 characters.");

    try {
        const res = await apiFetch(`/admin/users/${userId}/password`, {
            method: 'PUT',
            body: JSON.stringify({ newPassword: newPass })
        });
        if (res.ok) alert('Password successfully reset');
    } catch(e) { alert('Connection error'); }
}

async function adminDeleteUser(userId) {
    if(!confirm("WARNING: This will permanently delete the user and all associated data. Continue?")) return;
    try {
        const res = await apiFetch(`/admin/users/${userId}`, { method: 'DELETE' });
        if (res.ok) {
            loadUsers();
            loadAnalytics();
        }
    } catch(e) { alert('Connection error'); }
}

async function adminDeleteEvent(eventId) {
    if(!confirm("Delete this event?")) return;
    try {
        const res = await apiFetch(`/admin/events/${eventId}`, { method: 'DELETE' });
        if (res.ok) {
            loadEvents();
            loadAnalytics();
        }
    } catch(e) { alert('Connection error'); }
}

async function adminDeleteAssessment(id) {
    if(!confirm("Delete this assessment?")) return;
    try {
        const res = await apiFetch(`/admin/assessments/${id}`, { method: 'DELETE' });
        if (res.ok) {
            loadAssessments();
            loadAnalytics();
        }
    } catch(e) { alert('Connection error'); }
}
