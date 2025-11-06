/**
 * Currency formatting utilities
 */

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

/**
 * Format amount with currency symbol
 * @param {number} amount - The numeric amount to format
 * @param {string} currency - The currency code (USD, EUR, etc.)
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount, currency = 'USD') {
  const symbol = currencySymbols[currency] || '$';
  const absAmount = Math.abs(amount);
  
  const formatted = absAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // For some currencies, symbol goes after
  let result;
  if (currency === 'SEK' || currency === 'CHF') {
    result = `${formatted} ${symbol}`;
  } else {
    result = `${symbol}${formatted}`;
  }

  // Add negative sign if needed
  return amount < 0 ? `-${result}` : result;
}

/**
 * Get currency symbol for a given currency code
 * @param {string} currency - The currency code
 * @returns {string} Currency symbol
 */
function getCurrencySymbol(currency = 'USD') {
  return currencySymbols[currency] || '$';
}

/**
 * Get list of supported currencies
 * @returns {Array} Array of currency objects with code and name
 */
function getSupportedCurrencies() {
  return [
    { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
    { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
    { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', flag: '🇨🇭' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
    { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', flag: '🇸🇪' },
  ];
}

module.exports = {
  formatCurrency,
  getCurrencySymbol,
  getSupportedCurrencies,
  currencySymbols,
};
