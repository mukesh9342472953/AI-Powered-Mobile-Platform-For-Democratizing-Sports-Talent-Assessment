let registeredEvents = [];
let eventSearchTimeout = null;

document.addEventListener("DOMContentLoaded", async () => {
    if (typeof renderBottomNav === 'function') renderBottomNav('events');
    
    // Show create form if admin
    const userStr = localStorage.getItem('user');
    if (userStr) {
        const user = JSON.parse(userStr);
        if (user.role === 'admin' || user.role === 'recruiter') {
            const createSection = document.getElementById('create-event-section');
            if (createSection) createSection.style.display = 'block';
        }
    }

    await fetchRegisteredEvents();
    await fetchAllEvents();
});

function toggleCreateForm() {
    const form = document.getElementById('create-event-form');
    const icon = document.getElementById('create-icon');
    if (form.style.display === 'none') {
        form.style.display = 'block';
        if (icon) icon.style.transform = 'rotate(180deg)';
    } else {
        form.style.display = 'none';
        if (icon) icon.style.transform = 'rotate(0deg)';
    }
}

function debounceEventSearch() {
    if (eventSearchTimeout) clearTimeout(eventSearchTimeout);
    eventSearchTimeout = setTimeout(() => {
        fetchAllEvents();
    }, 400);
}

async function fetchRegisteredEvents() {
    try {
        const res = await apiFetch('/events/registrations');
        if (res.ok) {
            registeredEvents = await res.json();
        }
    } catch (e) {
        console.error(e);
    }
}

async function fetchAllEvents() {
    const content = document.getElementById('events-content');
    const searchInput = document.getElementById('event-search');
    const searchVal = searchInput ? searchInput.value : '';

    try {
        const queryParams = new URLSearchParams();
        if (searchVal) queryParams.append('search', searchVal);

        const res = await apiFetch(`/events?${queryParams.toString()}`);
        const result = await res.json();
        
        if (!res.ok || !result.success) throw new Error();

        const events = result.events || [];

        if (events.length === 0) {
            content.innerHTML = '<div style="text-align: center; color: var(--text-secondary); font-size: 13px; padding: 20px;">No events available</div>';
            return;
        }

        let html = '';
        events.forEach(ev => {
            const isRegistered = registeredEvents.includes(ev.id);
            const dateStr = new Date(ev.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
            
            const capacity = ev.capacity || 100;
            const regCount = ev.reg_count || 0;
            const availableSlots = capacity - regCount;
            const isFull = availableSlots <= 0;

            html += `
                <div class="card" style="margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                        <div>
                            <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px;">${ev.title}</div>
                            <div style="font-size: 12px; color: var(--primary); font-weight: 600;">${dateStr}</div>
                        </div>
                        ${isRegistered 
                            ? '<span style="background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">Joined</span>' 
                            : (isFull ? '<span style="background: rgba(248, 113, 113, 0.1); color: #f87171; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">Full</span>' : '')}
                    </div>
                    
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="map-pin" style="width:14px;height:14px;"></i> ${ev.venue}
                    </div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="user" style="width:14px;height:14px;"></i> Organizer: ${ev.organizer}
                    </div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="users" style="width:14px;height:14px;"></i> Available Slots: <span style="font-weight: 600; color: ${isFull ? '#f87171' : 'white'};">${availableSlots} / ${capacity}</span>
                    </div>

                    ${ev.description ? `<div style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px; line-height: 1.5;">${ev.description}</div>` : ''}
                    
                    ${!isRegistered 
                        ? `<button onclick="joinEvent(${ev.id})" class="btn" style="width: 100%; padding: 10px; font-size: 13px;" ${isFull ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>Join Event</button>`
                        : `<button onclick="cancelRegistration(${ev.id})" class="btn btn-secondary" style="width: 100%; padding: 10px; font-size: 13px; border: 1px solid #f87171; color: #f87171; background: rgba(248,113,113,0.1);">Leave Event</button>`
                    }
                </div>
            `;
        });
        
        content.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (e) {
        content.innerHTML = '<div style="text-align: center; color: #f87171; font-size: 13px; padding: 20px;">Unable to load events. Please try again.</div>';
    }
}

async function createEvent(e) {
    e.preventDefault();
    const msg = document.getElementById('events-msg');
    
    const capacityInput = document.getElementById('ev-capacity');
    const capacity = capacityInput ? capacityInput.value : 100;

    const payload = {
        title: document.getElementById('ev-title').value,
        description: document.getElementById('ev-desc').value,
        venue: document.getElementById('ev-venue').value,
        date: document.getElementById('ev-date').value,
        organizer: document.getElementById('ev-organizer').value,
        capacity: capacity
    };

    try {
        const res = await apiFetch('/events', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (res.ok) {
            msg.textContent = 'Event created successfully!';
            msg.style.color = '#34d399';
            document.getElementById('create-event-form').reset();
            toggleCreateForm();
            await fetchAllEvents();
        } else {
            msg.textContent = data.message || 'Failed to create event';
            msg.style.color = '#f87171';
        }
    } catch (err) {
        msg.textContent = 'Connection error';
        msg.style.color = '#f87171';
    }
    
    setTimeout(() => { msg.textContent = ''; }, 3000);
}

async function joinEvent(eventId) {
    try {
        const res = await apiFetch(`/events/join`, {
            method: 'POST',
            body: JSON.stringify({ eventId })
        });
        const data = await res.json();
        
        if (res.ok) {
            alert('Successfully joined the event!');
            await fetchRegisteredEvents();
            await fetchAllEvents();
        } else {
            alert(data.message || 'Failed to join event');
        }
    } catch (e) {
        alert('Connection error joining event');
    }
}

async function cancelRegistration(eventId) {
    if (!confirm('Are you sure you want to leave this event?')) return;
    
    try {
        const res = await apiFetch(`/events/cancel`, {
            method: 'POST',
            body: JSON.stringify({ eventId })
        });
        const data = await res.json();
        
        if (res.ok) {
            alert('Registration cancelled.');
            await fetchRegisteredEvents();
            await fetchAllEvents();
        } else {
            alert(data.message || 'Failed to cancel registration');
        }
    } catch (e) {
        alert('Connection error cancelling registration');
    }
}
