/**
 * Utilidades para aleatorización en juegos educativos
 * 
 * NOTA DE SEGURIDAD:
 * Estas funciones usan Math.random() que NO es criptográficamente seguro.
 * Son apropiadas SOLO para:
 * - Mezclar preguntas de juegos
 * - Ordenar elementos de UI
 * - Efectos visuales aleatorios
 * 
 * NO USAR para:
 * - Generación de tokens de sesión
 * - Contraseñas o claves
 * - Cualquier operación de seguridad
 */

/**
 * Mezcla aleatoriamente un array (Fisher-Yates shuffle)
 * Uso seguro: Solo para juegos educativos y ordenamiento de UI
 * @param {Array} array - Array a mezclar
 * @returns {Array} - Nuevo array mezclado
 */
export const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Obtiene N elementos aleatorios de un array
 * Uso seguro: Solo para selección de preguntas en juegos
 * @param {Array} array - Array fuente
 * @param {number} count - Cantidad de elementos a obtener
 * @returns {Array} - Array con elementos aleatorios
 */
export const getRandomElements = (array, count) => {
  const shuffled = shuffleArray(array);
  return shuffled.slice(0, Math.min(count, array.length));
};

/**
 * Mezcla palabras en una oración (para juegos de ordenar palabras)
 * Uso seguro: Solo para juegos de gramática
 * @param {string} sentence - Oración a mezclar
 * @returns {string[]} - Array de palabras mezcladas
 */
export const shuffleSentence = (sentence) => {
  return shuffleArray(sentence.split(' '));
};