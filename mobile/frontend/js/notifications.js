document.addEventListener("DOMContentLoaded", async () => {
    const content = document.getElementById('notifications-content');
    
    try {
        const res = await apiFetch('/notifications');
        const data = await res.json();
        
        if (!res.ok) throw new Error();

        if (data.length === 0) {
            content.innerHTML = '<div style="text-align: center; color: var(--text-secondary); font-size: 13px;">No notifications.</div>';
            return;
        }

        let html = '';
        data.forEach(notif => {
            let icon = 'bell';
            let color = 'var(--text-primary)';
            if (notif.type === 'assessment') { icon = 'video'; color = 'var(--primary)'; }
            else if (notif.type === 'event') { icon = 'calendar'; color = 'var(--secondary)'; }
            else if (notif.type === 'system') { icon = 'info'; color = 'var(--accent)'; }
            else if (notif.type === 'feedback') { icon = 'message-square'; color = '#a855f7'; }

            html += `
                <div class="card" id="notif-card-${notif.id}" style="display: flex; gap: 12px; align-items: flex-start; padding: 12px; margin-bottom: 12px; ${!notif.is_read ? 'border-left: 3px solid var(--primary);' : ''}">
                    <i data-lucide="${icon}" style="color: ${color}; width: 20px; height: 20px; margin-top: 2px;"></i>
                    <div style="flex: 1;">
                        <div style="font-size: 13px; margin-bottom: 4px; ${!notif.is_read ? 'font-weight: 600;' : ''}">${notif.message}</div>
                        <div style="font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;">
                            <span>${new Date(notif.created_at || notif.date).toLocaleString()}</span>
                            <div style="display: flex; gap: 8px;">
                                ${!notif.is_read ? `<button onclick="markAsRead(${notif.id})" style="background:none; border:none; color: var(--primary); font-size: 11px; cursor: pointer;">Mark Read</button>` : ''}
                                <button onclick="deleteNotification(${notif.id})" style="background:none; border:none; color: #f87171; font-size: 11px; cursor: pointer;">Delete</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        content.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) {
        content.innerHTML = '<div style="text-align: center; color: #f87171; font-size: 13px;">Failed to load notifications.</div>';
    }
});

async function markAsRead(id) {
    try {
        const res = await apiFetch(`/notifications/${id}/read`, { method: 'PUT' });
        if (res.ok) {
            window.location.reload();
        }
    } catch(e) {}
}

async function deleteNotification(id) {
    try {
        const res = await apiFetch(`/notifications/${id}`, { method: 'DELETE' });
        if (res.ok) {
            const card = document.getElementById(`notif-card-${id}`);
            if (card) card.remove();
        }
    } catch(e) {}
}
