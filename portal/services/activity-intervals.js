"use strict";
const { SECONDS_PER_DAY, MAX_INTERVALS_PER_DAY } = require("../constants/achievement.constant");

/**
 * The time a health worker was active on one IST day, kept as a list of intervals.
 * Each interval is [start, end) in seconds since IST midnight (0..86400), the list is sorted, and
 * intervals that overlap or touch are one interval. The seconds counted for the day are the total
 * length of the list, so time reported twice, by two tabs or two devices, or in any order, counts once.
 * It is stored as text: "32400-43200,43500-43800".
 */

/**
 * Sort the intervals and join the ones that overlap or touch.
 * @param {Array<[number, number]>} list
 * @returns {Array<[number, number]>}
 */
const normalize = (list) => {
  const sorted = list.map(([start, end]) => [start, end]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1]);
    else merged.push(interval);
  }
  return merged;
};

/**
 * Read the stored text. A part that is not a valid interval is skipped.
 * @param {string|null|undefined} text
 * @returns {Array<[number, number]>}
 */
const parseIntervals = (text) => {
  if (!text) return [];
  const list = [];
  for (const part of String(text).split(",")) {
    const [start, end] = part.split("-").map(Number);
    if (Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= SECONDS_PER_DAY) {
      list.push([start, end]);
    }
  }
  return normalize(list);
};

/**
 * @param {Array<[number, number]>} list
 * @returns {string}
 */
const formatIntervals = (list) => list.map(([start, end]) => `${start}-${end}`).join(",");

/**
 * The seconds covered by the intervals.
 * @param {Array<[number, number]>} list
 */
const totalSeconds = (list) => list.reduce((sum, [start, end]) => sum + (end - start), 0);

/**
 * Add [start, end) to the list, clipped to the day. When the result would hold more than
 * MAX_INTERVALS_PER_DAY separate intervals the list is returned as it was, so a day's row stays small.
 * @param {Array<[number, number]>} list
 * @param {number} start
 * @param {number} end
 * @returns {Array<[number, number]>}
 */
const addInterval = (list, start, end) => {
  const from = Math.max(0, start);
  const to = Math.min(SECONDS_PER_DAY, end);
  if (to <= from) return list;
  const merged = normalize([...list, [from, to]]);
  return merged.length > MAX_INTERVALS_PER_DAY ? list : merged;
};

module.exports = { normalize, parseIntervals, formatIntervals, totalSeconds, addInterval };
