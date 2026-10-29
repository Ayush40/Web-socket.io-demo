function maskPhoneNumber(text) {
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?(\d{2})[\d\s.-]{6,8}(\d{2})\b/g;
  return text.replace(phoneRegex, (match, prefix, suffix) => {
    const digitsOnly = match.replace(/\D/g, '');
    const middleCount = Math.max(digitsOnly.length - 4, 6);
    return `${prefix}${'*'.repeat(middleCount)}${suffix}`;
  });
}

function maskEmail(text) {
  const emailRegex = /([a-zA-Z0-9._%+-]+)(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  return text.replace(emailRegex, (match, userPart, domainPart) => {
    return `${'*'.repeat(userPart.length)}${domainPart}`;
  });
}

function maskSensitiveData(text) {
  if (!text || typeof text !== 'string') return text;
  return maskEmail(maskPhoneNumber(text));
}

module.exports = { maskSensitiveData };
