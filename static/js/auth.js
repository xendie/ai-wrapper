// Authentication JavaScript

// Check if we're on login or register page
const isLoginPage = window.location.pathname === '/login';
const isRegisterPage = window.location.pathname === '/register';

if (isLoginPage || isRegisterPage) {
    const form = document.getElementById(isLoginPage ? 'loginForm' : 'registerForm');
    const errorMessage = document.getElementById('errorMessage');
    const submitButton = document.getElementById('submitButton');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Clear previous errors
        errorMessage.textContent = '';
        errorMessage.style.display = 'none';
        submitButton.disabled = true;
        submitButton.textContent = isLoginPage ? 'Signing In...' : 'Creating Account...';
        
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });
        
        try {
            const endpoint = isLoginPage ? '/api/login' : '/api/register';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Success - redirect to chat
                window.location.href = '/';
            } else {
                // Show error
                errorMessage.textContent = result.error || 'An error occurred';
                errorMessage.style.display = 'block';
                submitButton.disabled = false;
                submitButton.textContent = isLoginPage ? 'Sign In' : 'Sign Up';
            }
        } catch (error) {
            errorMessage.textContent = 'Network error. Please try again.';
            errorMessage.style.display = 'block';
            submitButton.disabled = false;
            submitButton.textContent = isLoginPage ? 'Sign In' : 'Sign Up';
        }
    });
}
