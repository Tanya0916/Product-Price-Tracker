/**
 * Promise-based sleep utility with optional jitter
 * @param {number} ms Milliseconds to wait
 * @param {number} jitterRatio Ratio of random jitter (0 to 1)
 * @returns {Promise<void>}
 */
function sleep(ms, jitterRatio = 0) {
  let wait = ms;
  if (jitterRatio > 0) {
    const delta = ms * jitterRatio;
    wait = ms + (Math.random() * 2 - 1) * delta;
  }
  return new Promise(resolve => setTimeout(resolve, Math.max(0, wait)));
}

module.exports = { sleep };
