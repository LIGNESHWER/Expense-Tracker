// Profile photo upload handler
document.addEventListener('DOMContentLoaded', () => {
  const uploadBtn = document.getElementById('upload-photo-btn');
  const photoInput = document.getElementById('photo-upload');
  const profilePreview = document.getElementById('profile-preview');
  const hiddenPhotoInput = document.getElementById('profilePhoto');
  const currencySelect = document.getElementById('currency');
  const currencyExample = document.getElementById('currency-example');

  // Currency symbols mapping
  const currencySymbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
    CHF: 'Fr',
    CNY: '¥',
    SEK: 'kr',
  };

  // Currency formatting
  const formatCurrency = (amount, currency) => {
    const symbol = currencySymbols[currency] || '$';
    const formatted = amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // For some currencies, symbol goes after
    if (currency === 'SEK' || currency === 'CHF') {
      return `${formatted} ${symbol}`;
    }
    return `${symbol}${formatted}`;
  };

  // Update currency preview
  const updateCurrencyPreview = () => {
    const selectedCurrency = currencySelect.value;
    const sampleAmount = 1234.56;
    currencyExample.textContent = formatCurrency(sampleAmount, selectedCurrency);
  };

  // Initialize currency preview
  if (currencySelect && currencyExample) {
    updateCurrencyPreview();
    currencySelect.addEventListener('change', updateCurrencyPreview);
  }

  // Trigger file input when button is clicked
  if (uploadBtn && photoInput) {
    uploadBtn.addEventListener('click', () => {
      photoInput.click();
    });

    // Handle file selection
    photoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      
      if (!file) {
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file.');
        photoInput.value = '';
        return;
      }

      // Validate file size (200KB = 204800 bytes)
      if (file.size > 204800) {
        alert('Image size must be less than 200KB. Please choose a smaller image.');
        photoInput.value = '';
        return;
      }

      // Read and preview the image
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const base64Image = event.target.result;
        
        // Update preview
        if (profilePreview.tagName === 'IMG') {
          profilePreview.src = base64Image;
        } else {
          // Replace placeholder with image
          const img = document.createElement('img');
          img.src = base64Image;
          img.alt = 'Profile Photo';
          img.id = 'profile-preview';
          img.className = 'profile-photo-large';
          profilePreview.parentNode.replaceChild(img, profilePreview);
        }

        // Store base64 in hidden input
        if (hiddenPhotoInput) {
          hiddenPhotoInput.value = base64Image;
        }
      };

      reader.onerror = () => {
        alert('Error reading file. Please try again.');
        photoInput.value = '';
      };

      reader.readAsDataURL(file);
    });
  }

  // Form submission handler
  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', (e) => {
      const nameInput = document.getElementById('name');
      const emailInput = document.getElementById('email');

      // Basic validation
      if (!nameInput.value.trim() || nameInput.value.trim().length < 2) {
        e.preventDefault();
        alert('Name must be at least 2 characters long.');
        return;
      }

      if (!emailInput.value.trim() || !emailInput.value.includes('@')) {
        e.preventDefault();
        alert('Please enter a valid email address.');
        return;
      }

      // Show loading state
      const submitBtn = profileForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '💾 Saving...';
      }
    });
  }

  // Auto-hide success message after 5 seconds
  const successAlert = document.querySelector('.alert-success');
  if (successAlert) {
    setTimeout(() => {
      successAlert.style.opacity = '0';
      successAlert.style.transition = 'opacity 0.5s ease';
      setTimeout(() => {
        successAlert.remove();
      }, 500);
    }, 5000);
  }
});
