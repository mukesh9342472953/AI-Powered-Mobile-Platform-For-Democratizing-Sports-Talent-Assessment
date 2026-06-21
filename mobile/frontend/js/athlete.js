let isEditMode = false;
let profileExists = false;

document.addEventListener("DOMContentLoaded", async () => {
    // Render the bottom navigation (from common.js if available)
    if (typeof renderBottomNav === 'function') {
        renderBottomNav('profile'); // Assuming athlete uses profile nav for this page
    }
    
    // Set the display name from local storage initially
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user.name) {
        document.getElementById('display-name').textContent = user.name;
    }

    await loadProfile();
});

async function loadProfile() {
    try {
        const res = await apiFetch('/athletes/profile');
        
        if (res.status === 404) {
            // Profile doesn't exist yet, force edit mode to create one
            profileExists = false;
            toggleEditMode();
            document.getElementById('profile-msg').textContent = 'Please complete your profile.';
            document.getElementById('profile-msg').style.color = 'var(--text-secondary)';
            return;
        }

        if (!res.ok) throw new Error('Failed to load profile');

        const data = await res.json();
        profileExists = true;

        document.getElementById('sport').value = data.sport || '';
        document.getElementById('age').value = data.age || '';
        document.getElementById('gender').value = data.gender || 'Male';
        document.getElementById('district').value = data.district || '';
        document.getElementById('state').value = data.state || '';
        document.getElementById('achievements').value = data.achievements || '';

        document.getElementById('display-sport').textContent = data.sport || 'No Sport Assigned';

        if (data.profile_image) {
            const img = document.getElementById('profile-img');
            img.src = API_BASE_URL.replace('/api', '') + data.profile_image;
            img.style.display = 'block';
            document.getElementById('profile-icon').style.display = 'none';
        }
        
    } catch (e) {
        document.getElementById('profile-msg').textContent = e.message;
        document.getElementById('profile-msg').style.color = '#f87171';
    }
}

function toggleEditMode() {
    isEditMode = !isEditMode;
    const inputs = document.querySelectorAll('#profile-form .form-input');
    inputs.forEach(input => input.disabled = !isEditMode);
    
    const editBtn = document.getElementById('edit-btn');
    const saveBtn = document.getElementById('save-btn');
    
    if (isEditMode) {
        editBtn.textContent = 'Cancel';
        saveBtn.style.display = 'flex';
    } else {
        editBtn.textContent = 'Edit';
        saveBtn.style.display = 'none';
        if (profileExists) {
            loadProfile(); // Reload original data on cancel
        }
    }
}

async function saveProfile(e) {
    e.preventDefault();
    const msg = document.getElementById('profile-msg');
    msg.textContent = 'Saving...';
    msg.style.color = 'var(--text-secondary)';

    const bodyData = {
        sport: document.getElementById('sport').value,
        age: parseInt(document.getElementById('age').value),
        gender: document.getElementById('gender').value,
        district: document.getElementById('district').value,
        state: document.getElementById('state').value,
        achievements: document.getElementById('achievements').value
    };

    try {
        const method = profileExists ? 'PUT' : 'POST';
        const res = await apiFetch('/athletes/profile', {
            method: method,
            body: JSON.stringify(bodyData)
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || 'Failed to save');
        }

        msg.textContent = 'Profile saved successfully!';
        msg.style.color = '#34d399';
        
        profileExists = true;
        
        setTimeout(() => {
            msg.textContent = '';
            toggleEditMode();
            loadProfile(); // Reload to reflect changes like display-sport
        }, 1500);

    } catch (e) {
        msg.textContent = e.message;
        msg.style.color = '#f87171';
    }
}

async function uploadProfileImage(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    const token = localStorage.getItem('token');
    
    try {
        // Uploading directly using fetch because we need to send multipart/form-data
        const res = await fetch(`${API_BASE_URL}/athletes/profile/image`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await res.json();

        if (res.ok) {
            const img = document.getElementById('profile-img');
            img.src = API_BASE_URL.replace('/api', '') + data.profile_image;
            img.style.display = 'block';
            document.getElementById('profile-icon').style.display = 'none';
        } else {
            alert(data.message || 'Upload failed');
        }
    } catch (err) {
        alert('Connection error during upload');
    }
}
