async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('auth-error');
    errorEl.textContent = '';

    try {
        const healthRes = await fetch(`${API_BASE_URL}/health`);
        const healthData = await healthRes.json();
        if (healthData.status !== 'running') {
            throw new Error();
        }
    } catch (e) {
        errorEl.textContent = 'Backend server is not running. Please start backend.';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            errorEl.textContent = data.message || 'Login failed';
            return;
        }
        
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        redirectBasedOnRole(data.user.role);
    } catch (err) {
        errorEl.textContent = 'Connection server error';
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm_password')?.value;
    const role = document.getElementById('role').value;
    
    const errorEl = document.getElementById('auth-error');
    errorEl.textContent = '';

    if (password !== confirmPassword) {
        errorEl.textContent = 'Passwords do not match';
        return;
    }
    if (password.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters';
        return;
    }
    
    // Additional fields based on role
    const sport = role === 'athlete' ? document.getElementById('athlete-sport')?.value : (role === 'recruiter' ? document.getElementById('recruiter-sport')?.value : undefined);
    const age = document.getElementById('age')?.value;
    const gender = document.getElementById('gender')?.value;
    const height = document.getElementById('height')?.value;
    const weight = document.getElementById('weight')?.value;
    const district = document.getElementById('district')?.value;
    const state = document.getElementById('state')?.value;
    const specialization = role === 'coach' ? document.getElementById('coach-specialization')?.value : (role === 'recruiter' ? document.getElementById('recruiter-org')?.value : undefined);
    const experience = document.getElementById('coach-experience')?.value;
    
    const payload = {
        name, email, password, role,
        sport: role === 'athlete' || role === 'recruiter' ? sport : undefined,
        age: role === 'athlete' ? parseInt(age) : undefined,
        gender: role === 'athlete' ? gender : undefined,
        height: role === 'athlete' ? parseFloat(height) : undefined,
        weight: role === 'athlete' ? parseFloat(weight) : undefined,
        district: role === 'athlete' ? district : undefined,
        state: role === 'athlete' ? state : undefined,
        specialization: role === 'coach' || role === 'recruiter' ? specialization : undefined,
        experience: role === 'coach' ? parseInt(experience) : undefined
    };

    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            errorEl.textContent = data.message || 'Registration failed';
            return;
        }
        
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        redirectBasedOnRole(data.user.role);
    } catch (err) {
        errorEl.textContent = 'Connection server error';
    }
}

function toggleRoleFields() {
    const role = document.getElementById('role').value;
    const athleteFields = document.getElementById('athlete-fields');
    const coachFields = document.getElementById('coach-fields');
    const recruiterFields = document.getElementById('recruiter-fields');
    
    if (athleteFields) athleteFields.style.display = role === 'athlete' ? 'block' : 'none';
    if (coachFields) coachFields.style.display = role === 'coach' ? 'block' : 'none';
    if (recruiterFields) recruiterFields.style.display = role === 'recruiter' ? 'block' : 'none';
}
