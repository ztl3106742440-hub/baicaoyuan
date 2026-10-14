export const STAGE_INTERVAL_DAYS = Object.freeze([1, 3, 7, 14, 30, 60, 120]);

const validRatings = new Set(["unknown", "unstable", "known"]);

function asDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid review date");
  return date;
}

export function localDateKey(value = new Date()) {
  const date = asDate(value);
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addLocalDaysKey(value, days) {
  const date = asDate(value);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function normalizedStage(value) {
  const stage = Number.isInteger(value) ? value : 0;
  return Math.min(STAGE_INTERVAL_DAYS.length - 1, Math.max(0, stage));
}

export function scheduleWordRating(current = {}, rating, now = new Date()) {
  if (!validRatings.has(rating)) throw new TypeError(`Unsupported word rating: ${rating}`);
  const previousStage = normalizedStage(current.stage);
  const isNew = !current.lastRating;
  let stage;
  if (rating === "unknown") stage = 0;
  else if (rating === "unstable") stage = isNew ? 0 : Math.max(0, previousStage - 1);
  else stage = isNew ? 0 : Math.min(STAGE_INTERVAL_DAYS.length - 1, previousStage + 1);

  return {
    status: stage <= 2 ? "learning" : "review",
    stage,
    lastRating: rating,
    lastReviewedAt: asDate(now).toISOString(),
    dueDate: addLocalDaysKey(now, STAGE_INTERVAL_DAYS[stage]),
    correctStreak: rating === "known" ? (current.correctStreak ?? 0) + 1 : 0,
    lapses: rating === "unknown" ? (current.lapses ?? 0) + 1 : (current.lapses ?? 0),
    reviewCount: (current.reviewCount ?? 0) + 1,
    markedDifficult: rating === "unknown" ? true : Boolean(current.markedDifficult),
  };
}

function progressFor(progressById, wordId) {
  if (progressById instanceof Map) return progressById.get(wordId) ?? {};
  return progressById?.[wordId] ?? {};
}

function rotateByWordIndex(items, cursor, wordCount) {
  if (items.length < 2 || wordCount < 2) return [...items];
  const startIndex = ((cursor % wordCount) + wordCount) % wordCount;
  const offset = items.findIndex(({ index }) => index >= startIndex);
  if (offset <= 0) return [...items];
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function ratingPriority(record) {
  return ({ unknown: 0, unstable: 1, known: 2 })[record.lastRating] ?? 3;
}

export function selectStudySession(words, progressById, {
  size = 20,
  poolIds = null,
  cursor = 0,
  today = localDateKey(),
} = {}) {
  const safeSize = Math.max(1, Number.isInteger(size) ? size : 20);
  const allowed = poolIds ? new Set(poolIds) : null;
  const candidates = words
    .filter((word) => !allowed || allowed.has(word.id))
    .map((word, index) => ({ word, index, record: progressFor(progressById, word.id) }));

  const due = candidates
    .filter(({ record }) => record.lastRating && (!record.dueDate || record.dueDate <= today))
    .sort((left, right) => String(left.record.dueDate ?? "").localeCompare(String(right.record.dueDate ?? ""))
      || ratingPriority(left.record) - ratingPriority(right.record)
      || left.index - right.index);
  const fresh = candidates.filter(({ record }) => !record.lastRating);
  const future = candidates
    .filter(({ record }) => record.lastRating && record.dueDate && record.dueDate > today)
    .sort((left, right) => String(left.record.dueDate).localeCompare(String(right.record.dueDate))
      || ratingPriority(left.record) - ratingPriority(right.record)
      || left.index - right.index);

  const selected = [];
  let lastRotatedIndex = null;
  const addFrom = (source, { advancesCursor = false } = {}) => {
    for (const item of source) {
      if (selected.length >= safeSize) break;
      if (!selected.some((candidate) => candidate.word.id === item.word.id)) {
        selected.push(item);
        if (advancesCursor) lastRotatedIndex = item.index;
      }
    }
  };
  addFrom(due);
  addFrom(rotateByWordIndex(fresh, cursor, words.length), { advancesCursor: true });
  addFrom(rotateByWordIndex(future, cursor, words.length), { advancesCursor: true });

  const dueIds = new Set(due.map(({ word }) => word.id));
  const freshIds = new Set(fresh.map(({ word }) => word.id));
  return {
    words: selected.map(({ word }) => word),
    composition: {
      due: selected.filter(({ word }) => dueIds.has(word.id)).length,
      fresh: selected.filter(({ word }) => freshIds.has(word.id)).length,
      extra: selected.filter(({ word }) => !dueIds.has(word.id) && !freshIds.has(word.id)).length,
    },
    nextCursor: lastRotatedIndex == null ? cursor : (lastRotatedIndex + 1) % Math.max(1, words.length),
  };
}

export function reinforcementInsertionIndex(rating, currentIndex, queueLength) {
  if (rating === "unknown") return Math.min(queueLength, currentIndex + 6);
  if (rating === "unstable") return queueLength;
  return null;
}
