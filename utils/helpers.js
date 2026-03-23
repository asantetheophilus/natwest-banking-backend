// ─── Utility Helpers ───
const { v4: uuidv4 } = require('uuid');

/**
 * Generate a new UUID (v4)
 */
const generateId = () => uuidv4();

/**
 * Generate an 8-digit account number
 */
const generateAccountNumber = () => {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
};

/**
 * Generate a sort code in the format XX-XX-XX
 */
const generateSortCode = () => {
  const a = String(Math.floor(10 + Math.random() * 90));
  const b = String(Math.floor(10 + Math.random() * 90));
  const c = String(Math.floor(10 + Math.random() * 90));
  return `${a}-${b}-${c}`;
};

/**
 * Convert MySQL row snake_case to camelCase for frontend compatibility.
 * The frontend expects: accountNumber, sortCode, joinedAt, etc.
 */
const toCamelCase = (obj) => {
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj === null || typeof obj !== 'object') return obj;

  const camel = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    camel[camelKey] = value;
  }
  return camel;
};

module.exports = {
  generateId,
  generateAccountNumber,
  generateSortCode,
  toCamelCase,
};
