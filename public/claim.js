// claim.js — handles free install claim form submissions to backend API
// Posts to backend API

// Use localhost for development testing, production domain for live
const API_ENDPOINT = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000/api/leads'
  : 'https://app.northshoresignco.com/api/leads';

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initForm);
} else {
  initForm();
}

function initForm() {
  const form = document.getElementById('claimForm');
  if (!form) return; // Form not found
  form.addEventListener('submit', handleFormSubmit);
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const submitBtn = document.getElementById('submitBtn');
  const statusDiv = document.getElementById('formStatus');

  // Disable submit button and show loading state
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';
  statusDiv.className = '';

  // Collect form data
  const formData = {
    fullName: document.getElementById('fullName').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    email: document.getElementById('email').value.trim(),
    brokerage: document.getElementById('brokerage').value.trim(),
  };

  try {
    // Submit to backend API
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`${res.status}: ${error}`);
    }

    // Success
    showSuccess();
    document.getElementById('claimForm').reset();
    submitBtn.textContent = 'Claim My Free Install →';

  } catch (err) {
    console.error('Form submission error:', err);
    showError('Something went wrong. Please try again or text us: (206) 555-0100');
    submitBtn.textContent = 'Claim My Free Install →';
  } finally {
    submitBtn.disabled = false;
  }
}

function showSuccess() {
  const statusDiv = document.getElementById('formStatus');
  statusDiv.className = 'text-center mt-4 p-4 bg-green-50 border border-green-200 rounded-lg';
  statusDiv.innerHTML = '✓ <strong>Got it!</strong> We will call you within 24 hours to confirm your first free install.';
}

function showError(message) {
  const statusDiv = document.getElementById('formStatus');
  statusDiv.className = 'text-center mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700';
  statusDiv.textContent = message;
}
