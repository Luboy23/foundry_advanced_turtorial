const ADULT_YEARS = 18;

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function toYmdNumber(parts: DateParts) {
  return parts.year * 10_000 + parts.month * 100 + parts.day;
}

function splitYmdInput(value: string): DateParts | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const parts = {
    year: Number(yearRaw),
    month: Number(monthRaw),
    day: Number(dayRaw)
  };

  const timestamp = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== parts.year ||
    date.getUTCMonth() !== parts.month - 1 ||
    date.getUTCDate() !== parts.day
  ) {
    return null;
  }

  return parts;
}

export function parseStrictUtcDate(value: string) {
  const parts = splitYmdInput(value);
  if (!parts) {
    return null;
  }

  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0) / 1000);
}

export function unixTimestampToUtcYmd(timestamp: number) {
  const date = new Date(timestamp * 1000);
  return toYmdNumber({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  });
}

export function getCurrentUtcYmd() {
  return unixTimestampToUtcYmd(Math.floor(Date.now() / 1000));
}

export function splitYmdNumber(value: number): DateParts | null {
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }

  const year = Math.floor(value / 10_000);
  const month = Math.floor((value % 10_000) / 100);
  const day = value % 100;
  const timestamp = Date.UTC(year, month - 1, day, 0, 0, 0, 0);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return { year, month, day };
}

export function formatYmdDate(value: number | null | undefined) {
  if (!value) {
    return "暂无";
  }

  const parts = splitYmdNumber(value);
  if (!parts) {
    return "暂无";
  }

  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

export function calculateEligibleFromYmdFromBirthDate(value: string) {
  const parts = splitYmdInput(value);
  if (!parts) {
    return null;
  }

  const targetYear = parts.year + ADULT_YEARS;
  if (parts.month === 2 && parts.day === 29 && !isLeapYear(targetYear)) {
    return toYmdNumber({
      year: targetYear,
      month: 3,
      day: 1
    });
  }

  return toYmdNumber({
    year: targetYear,
    month: parts.month,
    day: parts.day
  });
}

export function calculateEligibleFromYmdFromUnixTimestamp(timestamp: number) {
  const birthDate = new Date(timestamp * 1000);
  return calculateEligibleFromYmdFromBirthDate(
    `${birthDate.getUTCFullYear()}-${String(birthDate.getUTCMonth() + 1).padStart(2, "0")}-${String(
      birthDate.getUTCDate()
    ).padStart(2, "0")}`
  );
}

export function isEligibleOnYmd(eligibleFromYmd: number | null | undefined, verificationDateYmd: number | null | undefined) {
  if (!eligibleFromYmd || !verificationDateYmd) {
    return false;
  }

  return eligibleFromYmd <= verificationDateYmd;
}
