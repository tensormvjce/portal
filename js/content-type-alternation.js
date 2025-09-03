/**
 * Content Type Alternation System
 * Manages alternating text/video posts on Sundays with 14-day intervals
 */

/**
 * Determines the post type for a given week based on alternation pattern
 * @param {string} weekKey - Week identifier (e.g., "Sep1-7", "Sep8-14")
 * @param {Object} postTypeSchedule - Current post type schedule from Firebase
 * @returns {string} "text" or "video"
 */
export function determinePostType(weekKey, postTypeSchedule = {}) {
  // If post type is already defined in schedule, return it
  if (postTypeSchedule[weekKey] && postTypeSchedule[weekKey].sunday) {
    return postTypeSchedule[weekKey].sunday.type || postTypeSchedule[weekKey].sunday;
  }
  
  // Parse week key to get start date
  const weekStartDate = parseWeekKey(weekKey);
  if (!weekStartDate) {
    console.error('Invalid week key format:', weekKey);
    return 'text'; // Default fallback
  }
  
  // Find Sunday in this week
  const sunday = findSundayInWeek(weekStartDate);
  
  // Calculate week number since Sep 1, 2025 (our reference point)
  const referenceDate = new Date(2025, 8, 1); // Sep 1, 2025
  const weeksSinceReference = Math.floor((sunday - referenceDate) / (7 * 24 * 60 * 60 * 1000));
  
  // Alternate: even weeks = text, odd weeks = video
  // Sep 1-7 (week 0) = text, Sep 8-14 (week 1) = video, Sep 15-21 (week 2) = text, etc.
  return weeksSinceReference % 2 === 0 ? 'text' : 'video';
}

/**
 * Calculates the next week that will have the same post type (14-day interval)
 * @param {string} currentWeek - Current week key
 * @param {string} postType - Post type ("text" or "video")
 * @returns {string} Week key for next occurrence of same post type
 */
export function getNextSameTypeWeek(currentWeek, postType) {
  const currentWeekDate = parseWeekKey(currentWeek);
  if (!currentWeekDate) {
    throw new Error(`Invalid week key format: ${currentWeek}`);
  }
  
  // Add 14 days (2 weeks) to get next same type
  const nextWeekDate = new Date(currentWeekDate);
  nextWeekDate.setDate(nextWeekDate.getDate() + 14);
  
  // Format back to week key
  return formatDateToWeekKey(nextWeekDate);
}

/**
 * Updates the post type schedule for multiple weeks
 * @param {Array} weekKeys - Array of week keys to update
 * @param {Object} existingSchedule - Current schedule from Firebase
 * @returns {Object} Updated post type schedule
 */
export function updatePostTypeSchedule(weekKeys, existingSchedule = {}) {
  const updatedSchedule = { ...existingSchedule };
  
  weekKeys.forEach(weekKey => {
    if (!updatedSchedule[weekKey]) {
      updatedSchedule[weekKey] = {};
    }
    
    // Determine post type for this week
    const postType = determinePostType(weekKey, existingSchedule);
    
    updatedSchedule[weekKey].sunday = {
      type: postType,
      assigned: false,
      maxAssignees: 6, // 3 content + 3 design
      currentAssignees: 0,
      assignments: []
    };
  });
  
  return updatedSchedule;
}

/**
 * Gets the post type information for a specific week
 * @param {string} weekKey - Week identifier
 * @param {Object} postTypeSchedule - Current schedule from Firebase
 * @returns {Object} Post type information with metadata
 */
export function getPostTypeInfo(weekKey, postTypeSchedule = {}) {
  const postType = determinePostType(weekKey, postTypeSchedule);
  const nextSameTypeWeek = getNextSameTypeWeek(weekKey, postType);
  
  return {
    weekKey,
    postType,
    nextSameTypeWeek,
    isAssigned: postTypeSchedule[weekKey]?.sunday?.assigned || false,
    currentAssignees: postTypeSchedule[weekKey]?.sunday?.currentAssignees || 0,
    maxAssignees: postTypeSchedule[weekKey]?.sunday?.maxAssignees || 6,
    assignments: postTypeSchedule[weekKey]?.sunday?.assignments || []
  };
}

/**
 * Validates if a user can be assigned to a Sunday post based on role limits
 * @param {string} weekKey - Week identifier
 * @param {string} role - User role ("content" or "design")
 * @param {Object} postTypeSchedule - Current schedule from Firebase
 * @returns {Object} Validation result with availability info
 */
export function validateSundayAssignment(weekKey, role, postTypeSchedule = {}) {
  const postInfo = getPostTypeInfo(weekKey, postTypeSchedule);
  const assignments = postInfo.assignments;
  
  // Count current assignments by role
  const contentCount = assignments.filter(a => a.role === 'content').length;
  const designCount = assignments.filter(a => a.role === 'design').length;
  
  const maxPerRole = 3; // 3 content + 3 design = 6 total
  
  let canAssign = false;
  let reason = '';
  
  if (role === 'content' && contentCount < maxPerRole) {
    canAssign = true;
  } else if (role === 'design' && designCount < maxPerRole) {
    canAssign = true;
  } else if (role === 'content') {
    reason = `Content role full (${contentCount}/${maxPerRole})`;
  } else if (role === 'design') {
    reason = `Design role full (${designCount}/${maxPerRole})`;
  } else {
    reason = 'Invalid role specified';
  }
  
  return {
    canAssign,
    reason,
    currentCounts: {
      content: contentCount,
      design: designCount,
      total: contentCount + designCount
    },
    maxCounts: {
      content: maxPerRole,
      design: maxPerRole,
      total: maxPerRole * 2
    },
    postType: postInfo.postType
  };
}

/**
 * Generates a complete post type schedule for a range of weeks
 * @param {Date} startDate - Starting date
 * @param {number} numberOfWeeks - Number of weeks to generate
 * @returns {Object} Complete post type schedule
 */
export function generatePostTypeSchedule(startDate = new Date(2025, 8, 1), numberOfWeeks = 20) {
  const schedule = {};
  const currentDate = new Date(startDate);
  
  for (let i = 0; i < numberOfWeeks; i++) {
    const weekKey = formatDateToWeekKey(currentDate);
    const postType = determinePostType(weekKey);
    
    schedule[weekKey] = {
      sunday: {
        type: postType,
        assigned: false,
        maxAssignees: 6,
        currentAssignees: 0,
        assignments: []
      }
    };
    
    // Move to next week
    currentDate.setDate(currentDate.getDate() + 7);
  }
  
  return schedule;
}

/**
 * Helper function to parse week key into Date object
 * @param {string} weekKey - Week key like "Sep1-7" or "Sep29-Oct5"
 * @returns {Date|null} Start date of the week or null if invalid
 */
function parseWeekKey(weekKey) {
  // Handle both same-month and cross-month formats
  const sameMonthMatch = weekKey.match(/([A-Za-z]+)(\d+)-(\d+)$/);
  const crossMonthMatch = weekKey.match(/([A-Za-z]+)(\d+)-([A-Za-z]+)(\d+)$/);
  
  const monthMap = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };
  
  if (crossMonthMatch) {
    // Cross-month format like "Sep29-Oct5"
    const startMonth = crossMonthMatch[1];
    const startDay = parseInt(crossMonthMatch[2]);
    const startMonthIndex = monthMap[startMonth];
    
    if (startMonthIndex === undefined) return null;
    return new Date(2025, startMonthIndex, startDay);
  } else if (sameMonthMatch) {
    // Same-month format like "Sep1-7"
    const monthAbbr = sameMonthMatch[1];
    const startDay = parseInt(sameMonthMatch[2]);
    const monthIndex = monthMap[monthAbbr];
    
    if (monthIndex === undefined) return null;
    return new Date(2025, monthIndex, startDay);
  }
  
  return null;
}

/**
 * Helper function to find Sunday in a given week
 * @param {Date} weekStart - Start date of the week
 * @returns {Date} Date of Sunday in that week
 */
function findSundayInWeek(weekStart) {
  const date = new Date(weekStart);
  const currentDay = date.getDay();
  const daysToSunday = (7 - currentDay) % 7;
  date.setDate(date.getDate() + daysToSunday);
  return date;
}

/**
 * Helper function to format Date object back to week key
 * @param {Date} date - Date within the week
 * @returns {string} Week key in format "Sep1-7"
 */
function formatDateToWeekKey(date) {
  const monthAbbr = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  
  // Find start of week (assuming weeks start on the day provided)
  const weekStart = new Date(date);
  const weekEnd = new Date(date);
  weekEnd.setDate(weekEnd.getDate() + 6);
  
  const startMonth = monthAbbr[weekStart.getMonth()];
  const endMonth = monthAbbr[weekEnd.getMonth()];
  const startDay = weekStart.getDate();
  const endDay = weekEnd.getDate();
  
  // Handle month transitions - use format like "Sep29-Oct5"
  if (startMonth === endMonth) {
    return `${startMonth}${startDay}-${endDay}`;
  } else {
    return `${startMonth}${startDay}-${endMonth}${endDay}`;
  }
}

/**
 * Firebase schema structure for post type schedule
 */
export const POST_TYPE_FIREBASE_SCHEMA = {
  postTypeSchedule: {
    "Sep1-7": {
      sunday: {
        type: "text",
        assigned: false,
        maxAssignees: 6,
        currentAssignees: 0,
        assignments: [
          {
            userId: "user123",
            name: "John Doe",
            role: "content",
            assignedAt: "2025-09-01T10:00:00Z",
            assignmentType: "manual"
          }
        ]
      }
    },
    "Sep8-14": {
      sunday: {
        type: "video",
        assigned: false,
        maxAssignees: 6,
        currentAssignees: 0,
        assignments: []
      }
    }
  }
};

/**
 * Assigns roles for Sunday posts with proper role distribution and limits
 * @param {string} weekKey - Week identifier
 * @param {Array} availableUsers - Array of available users with role information
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Assignment result with assigned users and status
 */
export async function assignSundayRoles(weekKey, availableUsers, database) {
  const { ref, get, set, update } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    // Get current post type schedule
    const scheduleRef = ref(database, `postTypeSchedule/${weekKey}`);
    const scheduleSnapshot = await get(scheduleRef);
    
    let weekData = scheduleSnapshot.exists() ? scheduleSnapshot.val() : null;
    
    // Initialize week data if it doesn't exist
    if (!weekData || !weekData.sunday) {
      const postType = determinePostType(weekKey);
      weekData = {
        sunday: {
          type: postType,
          assigned: false,
          maxAssignees: 6,
          currentAssignees: 0,
          assignments: []
        }
      };
    }
    
    const sundayData = weekData.sunday;
    const maxPerRole = 3; // 3 content + 3 design = 6 total
    
    // Count current assignments by role
    const currentAssignments = sundayData.assignments || [];
    const contentCount = currentAssignments.filter(a => a.role === 'content').length;
    const designCount = currentAssignments.filter(a => a.role === 'design').length;
    
    // Separate available users by role
    const contentUsers = availableUsers.filter(user => 
      user.role === 'content' && !currentAssignments.some(a => a.userId === user.userId)
    );
    const designUsers = availableUsers.filter(user => 
      user.role === 'design' && !currentAssignments.some(a => a.userId === user.userId)
    );
    
    const assignments = [];
    const errors = [];
    
    // Assign content members (up to 3)
    const contentSlotsNeeded = Math.min(maxPerRole - contentCount, contentUsers.length);
    for (let i = 0; i < contentSlotsNeeded; i++) {
      const user = contentUsers[i];
      const assignment = {
        userId: user.userId,
        name: user.name,
        role: 'content',
        assignedAt: new Date().toISOString(),
        assignmentType: 'automatic',
        postType: sundayData.type
      };
      assignments.push(assignment);
      currentAssignments.push(assignment);
    }
    
    // Assign design members (up to 3)
    const designSlotsNeeded = Math.min(maxPerRole - designCount, designUsers.length);
    for (let i = 0; i < designSlotsNeeded; i++) {
      const user = designUsers[i];
      const assignment = {
        userId: user.userId,
        name: user.name,
        role: 'design',
        assignedAt: new Date().toISOString(),
        assignmentType: 'automatic',
        postType: sundayData.type
      };
      assignments.push(assignment);
      currentAssignments.push(assignment);
    }
    
    // Check for insufficient users
    if (contentSlotsNeeded > contentUsers.length) {
      errors.push(`Insufficient content members: needed ${contentSlotsNeeded}, available ${contentUsers.length}`);
    }
    if (designSlotsNeeded > designUsers.length) {
      errors.push(`Insufficient design members: needed ${designSlotsNeeded}, available ${designUsers.length}`);
    }
    
    // Update Firebase with new assignments
    const updatedSundayData = {
      ...sundayData,
      assignments: currentAssignments,
      currentAssignees: currentAssignments.length,
      assigned: currentAssignments.length === 6, // Fully assigned when we have 6 members
      lastUpdated: new Date().toISOString()
    };
    
    await set(scheduleRef, { sunday: updatedSundayData });
    
    // Also update the main bookings structure for compatibility
    if (assignments.length > 0) {
      const bookingsRef = ref(database, `bookings/${weekKey}/Sunday`);
      const bookingUpdates = {};
      
      assignments.forEach(assignment => {
        const bookingKey = `${assignment.role}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        bookingUpdates[`${assignment.role}/${bookingKey}`] = {
          name: assignment.name,
          number: assignment.userId, // Using userId as number for now
          timestamp: assignment.assignedAt,
          assignmentType: assignment.assignmentType,
          postType: assignment.postType
        };
      });
      
      await update(bookingsRef, bookingUpdates);
    }
    
    return {
      success: true,
      weekKey,
      postType: sundayData.type,
      assignments,
      totalAssigned: currentAssignments.length,
      maxAssignees: 6,
      roleDistribution: {
        content: currentAssignments.filter(a => a.role === 'content').length,
        design: currentAssignments.filter(a => a.role === 'design').length
      },
      errors,
      isFullyAssigned: currentAssignments.length === 6
    };
    
  } catch (error) {
    console.error('Error assigning Sunday roles:', error);
    return {
      success: false,
      error: error.message,
      weekKey,
      assignments: []
    };
  }
}

/**
 * Validates if Sunday post assignment can proceed for a given week
 * @param {string} weekKey - Week identifier
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Validation result with current status
 */
export async function validateSundayPostAssignment(weekKey, database) {
  const { ref, get } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    const scheduleRef = ref(database, `postTypeSchedule/${weekKey}`);
    const scheduleSnapshot = await get(scheduleRef);
    
    if (!scheduleSnapshot.exists()) {
      return {
        canAssign: true,
        reason: 'No existing assignments',
        currentAssignments: 0,
        maxAssignments: 6,
        postType: determinePostType(weekKey)
      };
    }
    
    const sundayData = scheduleSnapshot.val().sunday;
    const currentAssignments = sundayData.assignments || [];
    const contentCount = currentAssignments.filter(a => a.role === 'content').length;
    const designCount = currentAssignments.filter(a => a.role === 'design').length;
    
    return {
      canAssign: currentAssignments.length < 6,
      reason: currentAssignments.length >= 6 ? 'All slots filled' : 'Slots available',
      currentAssignments: currentAssignments.length,
      maxAssignments: 6,
      postType: sundayData.type,
      roleDistribution: {
        content: { current: contentCount, max: 3 },
        design: { current: designCount, max: 3 }
      },
      availableSlots: {
        content: Math.max(0, 3 - contentCount),
        design: Math.max(0, 3 - designCount)
      }
    };
    
  } catch (error) {
    console.error('Error validating Sunday assignment:', error);
    return {
      canAssign: false,
      reason: `Validation error: ${error.message}`,
      currentAssignments: 0,
      maxAssignments: 6
    };
  }
}

/**
 * Gets Sunday assignment status for multiple weeks
 * @param {Array} weekKeys - Array of week identifiers
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Status for each week
 */
export async function getSundayAssignmentStatus(weekKeys, database) {
  const { ref, get } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    const status = {};
    
    for (const weekKey of weekKeys) {
      const validation = await validateSundayPostAssignment(weekKey, database);
      status[weekKey] = validation;
    }
    
    return status;
    
  } catch (error) {
    console.error('Error getting Sunday assignment status:', error);
    return {};
  }
}

/**
 * Removes a user from Sunday post assignment
 * @param {string} weekKey - Week identifier
 * @param {string} userId - User ID to remove
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Removal result
 */
export async function removeSundayAssignment(weekKey, userId, database) {
  const { ref, get, set, remove } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    const scheduleRef = ref(database, `postTypeSchedule/${weekKey}`);
    const scheduleSnapshot = await get(scheduleRef);
    
    if (!scheduleSnapshot.exists()) {
      return {
        success: false,
        error: 'No assignments found for this week'
      };
    }
    
    const weekData = scheduleSnapshot.val();
    const sundayData = weekData.sunday;
    const currentAssignments = sundayData.assignments || [];
    
    // Find and remove the assignment
    const assignmentIndex = currentAssignments.findIndex(a => a.userId === userId);
    if (assignmentIndex === -1) {
      return {
        success: false,
        error: 'User not found in assignments'
      };
    }
    
    const removedAssignment = currentAssignments[assignmentIndex];
    currentAssignments.splice(assignmentIndex, 1);
    
    // Update Sunday data
    const updatedSundayData = {
      ...sundayData,
      assignments: currentAssignments,
      currentAssignees: currentAssignments.length,
      assigned: currentAssignments.length === 6,
      lastUpdated: new Date().toISOString()
    };
    
    await set(scheduleRef, { sunday: updatedSundayData });
    
    // Also remove from main bookings structure
    const bookingsRef = ref(database, `bookings/${weekKey}/Sunday/${removedAssignment.role}`);
    const bookingsSnapshot = await get(bookingsRef);
    
    if (bookingsSnapshot.exists()) {
      const bookings = bookingsSnapshot.val();
      const bookingToRemove = Object.keys(bookings).find(key => 
        bookings[key].name === removedAssignment.name
      );
      
      if (bookingToRemove) {
        await remove(ref(database, `bookings/${weekKey}/Sunday/${removedAssignment.role}/${bookingToRemove}`));
      }
    }
    
    return {
      success: true,
      removedAssignment,
      remainingAssignments: currentAssignments.length,
      weekKey
    };
    
  } catch (error) {
    console.error('Error removing Sunday assignment:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Initializes post type schedule in Firebase
 * @param {Object} database - Firebase database reference
 * @param {number} numberOfWeeks - Number of weeks to initialize
 * @returns {Promise} Promise that resolves when initialization is complete
 */
export async function initializePostTypeSchedule(database, numberOfWeeks = 20) {
  const { ref, set, get } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    const scheduleRef = ref(database, 'postTypeSchedule');
    const scheduleSnapshot = await get(scheduleRef);
    
    if (!scheduleSnapshot.exists()) {
      const initialSchedule = generatePostTypeSchedule(new Date(2025, 8, 1), numberOfWeeks);
      await set(scheduleRef, initialSchedule);
      console.log('Post type schedule initialized in Firebase');
      return initialSchedule;
    } else {
      console.log('Post type schedule already exists in Firebase');
      return scheduleSnapshot.val();
    }
  } catch (error) {
    console.error('Error initializing post type schedule:', error);
    throw error;
  }
}