/**
 * Automated Date Range Generation System
 * Handles weekly date range generation and deadline calculation
 */

/**
 * Generates weekly date ranges starting from a base date
 * Creates ranges in format: Sep1-7, Sep8-14, Sep15-21, etc.
 * @param {Date} startDate - The starting date for range generation
 * @param {number} numberOfWeeks - Number of weeks to generate
 * @returns {Array} Array of week objects with keys and date ranges
 */
export function generateWeeklyDateRanges(startDate = new Date(2025, 8, 1), numberOfWeeks = 20) {
  const weeks = [];
  const currentDate = new Date(startDate);
  
  // Month abbreviations for formatting
  const monthAbbr = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  
  for (let i = 0; i < numberOfWeeks; i++) {
    // Calculate start of week (always start from the provided date)
    const weekStart = new Date(currentDate);
    
    // Calculate end of week (6 days later)
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    // Format week key (e.g., "Sep1-7", "Sep8-14")
    const startMonth = monthAbbr[weekStart.getMonth()];
    const endMonth = monthAbbr[weekEnd.getMonth()];
    const startDay = weekStart.getDate();
    const endDay = weekEnd.getDate();
    
    // Create week key - handle month transitions
    let weekKey;
    if (startMonth === endMonth) {
      weekKey = `${startMonth}${startDay}-${endDay}`;
    } else {
      weekKey = `${startMonth}${startDay}-${endMonth}${endDay}`;
    }
    
    // Find Wednesday and Sunday in this week
    const wednesday = findDayInWeek(weekStart, 3); // Wednesday = 3
    const sunday = findDayInWeek(weekStart, 0);    // Sunday = 0
    
    weeks.push({
      key: weekKey,
      startDate: new Date(weekStart),
      endDate: new Date(weekEnd),
      days: {
        Wednesday: wednesday,
        Sunday: sunday
      },
      cycle: Math.floor(i / 2) + 1, // Each cycle contains 2 weeks
      weekInCycle: (i % 2) + 1      // 1 or 2
    });
    
    // Move to next week (7 days later)
    currentDate.setDate(currentDate.getDate() + 7);
  }
  
  return weeks;
}

/**
 * Finds a specific day of the week within a given week
 * @param {Date} weekStart - Start date of the week
 * @param {number} targetDay - Target day (0=Sunday, 1=Monday, ..., 6=Saturday)
 * @returns {Date} Date object for the target day
 */
function findDayInWeek(weekStart, targetDay) {
  const date = new Date(weekStart);
  const currentDay = date.getDay();
  const daysToAdd = (targetDay - currentDay + 7) % 7;
  date.setDate(date.getDate() + daysToAdd);
  return date;
}

/**
 * Calculates deadline for a given week (7 PM IST on the day before week starts)
 * @param {string} weekKey - Week identifier (e.g., "Sep8-14")
 * @param {Date} weekStartDate - Start date of the week
 * @returns {Date} Deadline date and time in IST
 */
export function calculateWeekDeadlines(weekKey, weekStartDate) {
  // Deadline is 7 PM IST on the day before the week starts
  const deadline = new Date(weekStartDate);
  deadline.setDate(deadline.getDate() - 1); // Day before week starts
  deadline.setHours(19, 0, 0, 0); // 7 PM
  
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const utcDeadline = new Date(deadline.getTime() - istOffset);
  
  return {
    weekKey,
    deadline: utcDeadline,
    deadlineIST: deadline,
    formattedDeadline: deadline.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  };
}

/**
 * Gets the current active weeks based on current date and cycle
 * @param {number} currentCycle - Current cycle number
 * @returns {Object} Object containing current and next week information
 */
export function getCurrentActiveWeeks(currentCycle = 1) {
  const allWeeks = generateWeeklyDateRanges();
  const cycleWeeks = allWeeks.filter(week => week.cycle === currentCycle);
  
  if (cycleWeeks.length < 2) {
    throw new Error(`Invalid cycle ${currentCycle}: not enough weeks generated`);
  }
  
  const currentWeek = cycleWeeks[0]; // First week of cycle (completed/current)
  const nextWeek = cycleWeeks[1];    // Second week of cycle (booking open)
  
  return {
    currentCycle,
    currentWeek: currentWeek.key,
    nextWeek: nextWeek.key,
    bookingWeek: nextWeek.key, // Week that users can book for
    weeks: {
      [currentWeek.key]: currentWeek,
      [nextWeek.key]: nextWeek
    },
    deadlines: {
      [nextWeek.key]: calculateWeekDeadlines(nextWeek.key, nextWeek.startDate)
    }
  };
}

/**
 * Advances to the next cycle (next 2-week period)
 * @param {number} currentCycle - Current cycle number
 * @returns {Object} New active weeks information
 */
export function advanceToNextCycle(currentCycle) {
  const nextCycle = currentCycle + 1;
  return getCurrentActiveWeeks(nextCycle);
}

/**
 * Checks if the current time has passed the deadline for a given week
 * @param {Date} deadline - Deadline date/time
 * @returns {boolean} True if deadline has passed
 */
export function isDeadlinePassed(deadline) {
  const now = new Date();
  return now >= deadline;
}

/**
 * Firebase schema structure for storing week configuration
 * This defines the data structure that should be stored in Firebase
 */
export const FIREBASE_SCHEMA = {
  weekConfiguration: {
    currentCycle: 1,
    activeWeeks: ["Sep1-7", "Sep8-14"],
    currentBookingWeek: "Sep8-14",
    lastUpdated: "2025-09-02T10:00:00Z",
    deadlines: {
      "Sep8-14": "2025-09-07T19:00:00+05:30"
    },
    postTypeSchedule: {
      "Sep1-7": { sunday: "text" },
      "Sep8-14": { sunday: "video" }
    }
  },
  
  // Cycle history for tracking transitions
  cycleHistory: {
    cycle1: {
      weeks: ["Sep1-7", "Sep8-14"],
      startDate: "2025-09-01T00:00:00Z",
      endDate: "2025-09-14T23:59:59Z",
      completed: false
    }
  },
  
  // System configuration
  systemConfig: {
    deadlineHour: 19, // 7 PM
    deadlineMinute: 0,
    timezone: "Asia/Kolkata",
    weeksPerCycle: 2,
    autoAdvanceEnabled: true
  }
};

/**
 * Initializes the Firebase schema with default values
 * @param {Object} database - Firebase database reference
 * @returns {Promise} Promise that resolves when initialization is complete
 */
export async function initializeFirebaseSchema(database) {
  const { ref, set, get } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    // Check if configuration already exists
    const configRef = ref(database, 'weekConfiguration');
    const configSnapshot = await get(configRef);
    
    if (!configSnapshot.exists()) {
      // Initialize with default configuration
      const initialWeeks = getCurrentActiveWeeks(1);
      
      const initialConfig = {
        currentCycle: 1,
        activeWeeks: [initialWeeks.currentWeek, initialWeeks.nextWeek],
        currentBookingWeek: initialWeeks.bookingWeek,
        lastUpdated: new Date().toISOString(),
        deadlines: initialWeeks.deadlines,
        postTypeSchedule: {
          [initialWeeks.currentWeek]: { sunday: "text" },
          [initialWeeks.nextWeek]: { sunday: "video" }
        }
      };
      
      await set(configRef, initialConfig);
      console.log('Firebase schema initialized with default configuration');
      return initialConfig;
    } else {
      console.log('Firebase schema already exists');
      return configSnapshot.val();
    }
  } catch (error) {
    console.error('Error initializing Firebase schema:', error);
    throw error;
  }
}