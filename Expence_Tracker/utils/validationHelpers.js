function sanitizeText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized;
}

function normalizeCategory(value) {
  const sanitized = sanitizeText(value);
  return sanitized.toLowerCase();
}

module.exports = {
  sanitizeText,
  normalizeCategory,
};
