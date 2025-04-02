/**
 * Generates a random numeric code of specified length
 * @param {number} length - The length of the code to generate
 * @returns {string} A random numeric code
 */
export const generateRandomCode = (length = 6) => {
  // Ensure length is valid
  if (length <= 0) {
    throw new Error('Code length must be a positive number');
  }
  
  // Generate a random numeric code of the specified length
  let code = '';
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  
  return code;
}; 