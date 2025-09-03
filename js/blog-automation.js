/**
 * Wednesday Blog Post Automation System
 * Handles automatic blog post assignments every Wednesday
 */

/**
 * Firebase schema structure for blog automation
 */
export const BLOG_AUTOMATION_FIREBASE_SCHEMA = {
  blogAssignments: {
    "Sep1-Sep7": {
      wednesday: {
        assigned: true,
        assignedAt: "2025-09-03T10:00:00Z",
        assignmentType: "automatic",
        assignee: {
          userId: "user123",
          name: "John Doe",
          number: "+91XXXXXXXXXX"
        },
        deadline: "2025-09-10T23:59:59Z", // End of week
        status: "pending" // pending, completed, overdue
      }
    }
  },
  
  blogWriters: {
    "user123": {
      name: "John Doe",
      number: "+91XXXXXXXXXX",
      isAvailable: true,
      totalBlogAssignments: 5,
      lastBlogAssignment: "Sep1-Sep7",
      assignmentHistory: [
        {
          week: "Aug25-Aug31",
          assignedAt: "2025-08-28T10:00:00Z",
          completedAt: "2025-09-03T15:30:00Z",
          status: "completed"
        }
      ]
    }
  },
  
  blogQueue: {
    pendingAssignments: [
      {
        week: "Sep8-Sep14",
        scheduledFor: "2025-09-10T10:00:00Z", // Wednesday of that week
        priority: 1
      }
    ]
  }
};

/**
 * Schedules Wednesday blog posts for available blog writers
 * @param {string} weekKey - Week identifier (e.g., "Sep8-14")
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Assignment result
 */
export async function scheduleWednesdayBlogPosts(weekKey, database) {
  const { ref, get, set, update } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    console.log(`Scheduling Wednesday blog post for week: ${weekKey}`);
    
    // Check if blog post is already assigned for this week
    const blogAssignmentRef = ref(database, `blogAssignments/${weekKey}`);
    const existingAssignment = await get(blogAssignmentRef);
    
    if (existingAssignment.exists() && existingAssignment.val().wednesday?.assigned) {
      return {
        success: false,
        reason: 'Blog post already assigned for this week',
        weekKey,
        existingAssignment: existingAssignment.val().wednesday
      };
    }
    
    // Get available blog writers
    const availableWriters = await getAvailableBlogWriters(weekKey, database);
    
    if (availableWriters.length === 0) {
      // Queue the assignment for later
      await queueBlogAssignment(weekKey, database);
      return {
        success: false,
        reason: 'No available blog writers, assignment queued',
        weekKey,
        queuedAssignment: true
      };
    }
    
    // Select optimal writer (least assignments, longest time since last assignment)
    const selectedWriter = selectOptimalBlogWriter(availableWriters);
    
    // Create assignment
    const assignment = {
      assigned: true,
      assignedAt: new Date().toISOString(),
      assignmentType: 'automatic',
      assignee: {
        userId: selectedWriter.userId,
        name: selectedWriter.name,
        number: selectedWriter.number
      },
      deadline: calculateBlogDeadline(weekKey),
      status: 'pending',
      weekKey
    };
    
    // Save assignment to Firebase
    await set(ref(database, `blogAssignments/${weekKey}/wednesday`), assignment);
    
    // Update writer's assignment history using break logic system
    const { updateAssignmentHistory } = await import('./break-logic.js');
    await updateAssignmentHistory(selectedWriter.userId, {
      week: weekKey,
      day: 'Wednesday',
      role: 'blog',
      assignedAt: assignment.assignedAt,
      assignmentType: 'automatic'
    }, database);
    
    // Update blog writer specific tracking
    await updateBlogWriterHistory(selectedWriter.userId, weekKey, database);
    
    // Add to main bookings structure for compatibility
    await addBlogToBookings(weekKey, assignment, database);
    
    // Send notification
    const notificationResult = await sendBlogAssignmentNotification(assignment);
    
    console.log(`Blog post assigned to ${selectedWriter.name} for week ${weekKey}`);
    
    return {
      success: true,
      weekKey,
      assignment,
      selectedWriter,
      notificationSent: notificationResult.success,
      notificationError: notificationResult.error
    };
    
  } catch (error) {
    console.error('Error scheduling Wednesday blog post:', error);
    return {
      success: false,
      error: error.message,
      weekKey
    };
  }
}

/**
 * Gets available blog writers for a specific week
 * @param {string} weekKey - Week identifier
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Array>} Array of available blog writers
 */
export async function getAvailableBlogWriters(weekKey, database) {
  try {
    // Import break logic to check eligibility
    const { getEligibleUsers } = await import('./break-logic.js');
    
    // Get eligible content team members (blog writers are from content team)
    const eligibleUsers = await getEligibleUsers('blog', weekKey, database);
    
    // Filter for blog writers specifically (those who have blog writing capability)
    const blogWriters = eligibleUsers.filter(user => {
      // For now, assume all content team members can write blogs
      // In future, this could be based on a specific "canWriteBlogs" field
      return user.teamType === 'contentTeam';
    });
    
    console.log(`Found ${blogWriters.length} available blog writers for ${weekKey}:`, 
      blogWriters.map(w => `${w.name} (${w.totalAssignments} total assignments)`));
    
    return blogWriters;
    
  } catch (error) {
    console.error('Error getting available blog writers:', error);
    return [];
  }
}

/**
 * Selects the optimal blog writer based on workload and assignment history
 * @param {Array} availableWriters - Array of available writers
 * @returns {Object} Selected writer
 */
function selectOptimalBlogWriter(availableWriters) {
  if (availableWriters.length === 0) {
    throw new Error('No available writers to select from');
  }
  
  if (availableWriters.length === 1) {
    return availableWriters[0];
  }
  
  // Sort by priority:
  // 1. Fewest total assignments
  // 2. Longest time since last assignment
  // 3. Random selection for ties
  const sortedWriters = availableWriters.sort((a, b) => {
    // Primary: total assignments (ascending)
    if (a.totalAssignments !== b.totalAssignments) {
      return a.totalAssignments - b.totalAssignments;
    }
    
    // Secondary: last assigned week (oldest first, null values first)
    if (!a.lastAssignedWeek && !b.lastAssignedWeek) return Math.random() - 0.5;
    if (!a.lastAssignedWeek) return -1;
    if (!b.lastAssignedWeek) return 1;
    
    // Compare week dates (earlier weeks = longer time since assignment)
    return a.lastAssignedWeek.localeCompare(b.lastAssignedWeek);
  });
  
  const selected = sortedWriters[0];
  console.log(`Selected blog writer: ${selected.name} (${selected.totalAssignments} assignments, last: ${selected.lastAssignedWeek || 'never'})`);
  
  return selected;
}

/**
 * Calculates the deadline for a blog post (end of the week)
 * @param {string} weekKey - Week identifier
 * @returns {string} ISO date string for deadline
 */
function calculateBlogDeadline(weekKey) {
  try {
    // Parse week key to get end date
    const { parseWeekKey } = await import('./break-logic.js');
    const weekStart = parseWeekKey(weekKey);
    
    if (!weekStart) {
      // Fallback calculation
      const endOfWeek = new Date();
      endOfWeek.setDate(endOfWeek.getDate() + 7);
      endOfWeek.setHours(23, 59, 59, 999);
      return endOfWeek.toISOString();
    }
    
    // Calculate end of week (6 days after start)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    return weekEnd.toISOString();
    
  } catch (error) {
    console.error('Error calculating blog deadline:', error);
    // Fallback: 7 days from now
    const fallbackDeadline = new Date();
    fallbackDeadline.setDate(fallbackDeadline.getDate() + 7);
    fallbackDeadline.setHours(23, 59, 59, 999);
    return fallbackDeadline.toISOString();
  }
}

/**
 * Queues a blog assignment when no writers are available
 * @param {string} weekKey - Week identifier
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Queue result
 */
async function queueBlogAssignment(weekKey, database) {
  const { ref, get, set, push } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    const queueRef = ref(database, 'blogQueue/pendingAssignments');
    
    // Check if already queued
    const queueSnapshot = await get(queueRef);
    if (queueSnapshot.exists()) {
      const pendingAssignments = queueSnapshot.val();
      const alreadyQueued = Object.values(pendingAssignments).some(
        assignment => assignment.week === weekKey
      );
      
      if (alreadyQueued) {
        console.log(`Blog assignment for ${weekKey} already queued`);
        return { success: true, alreadyQueued: true };
      }
    }
    
    // Add to queue
    const queuedAssignment = {
      week: weekKey,
      queuedAt: new Date().toISOString(),
      scheduledFor: calculateWednesdayDate(weekKey),
      priority: 1,
      attempts: 0
    };
    
    await push(queueRef, queuedAssignment);
    
    console.log(`Blog assignment queued for ${weekKey}`);
    return { success: true, queuedAssignment };
    
  } catch (error) {
    console.error('Error queuing blog assignment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Calculates the Wednesday date for a given week
 * @param {string} weekKey - Week identifier
 * @returns {string} ISO date string for Wednesday
 */
function calculateWednesdayDate(weekKey) {
  try {
    // This is a simplified calculation - in production you'd want more robust date parsing
    const currentDate = new Date();
    const wednesday = new Date(currentDate);
    
    // Find next Wednesday
    const daysUntilWednesday = (3 - currentDate.getDay() + 7) % 7;
    wednesday.setDate(currentDate.getDate() + daysUntilWednesday);
    wednesday.setHours(10, 0, 0, 0); // 10 AM assignment time
    
    return wednesday.toISOString();
  } catch (error) {
    console.error('Error calculating Wednesday date:', error);
    return new Date().toISOString();
  }
}

/**
 * Updates blog writer specific assignment history
 * @param {string} userId - User identifier
 * @param {string} weekKey - Week identifier
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Update result
 */
async function updateBlogWriterHistory(userId, weekKey, database) {
  const { ref, get, update } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    const writerRef = ref(database, `blogWriters/${userId}`);
    const writerSnapshot = await get(writerRef);
    
    let writerData = writerSnapshot.exists() ? writerSnapshot.val() : {
      totalBlogAssignments: 0,
      assignmentHistory: []
    };
    
    // Update blog-specific tracking
    const blogAssignment = {
      week: weekKey,
      assignedAt: new Date().toISOString(),
      status: 'pending'
    };
    
    if (!writerData.assignmentHistory) {
      writerData.assignmentHistory = [];
    }
    
    writerData.assignmentHistory.push(blogAssignment);
    writerData.totalBlogAssignments = (writerData.totalBlogAssignments || 0) + 1;
    writerData.lastBlogAssignment = weekKey;
    writerData.lastUpdated = new Date().toISOString();
    
    await update(writerRef, writerData);
    
    console.log(`Updated blog writer history for ${userId}`);
    return { success: true, writerData };
    
  } catch (error) {
    console.error('Error updating blog writer history:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Adds blog assignment to main bookings structure for compatibility
 * @param {string} weekKey - Week identifier
 * @param {Object} assignment - Assignment object
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Update result
 */
async function addBlogToBookings(weekKey, assignment, database) {
  const { ref, push } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    const bookingRef = ref(database, `bookings/${weekKey}/Wednesday/blog`);
    
    const bookingData = {
      name: assignment.assignee.name,
      number: assignment.assignee.number,
      timestamp: assignment.assignedAt,
      assignmentType: assignment.assignmentType,
      role: 'blog',
      deadline: assignment.deadline,
      status: assignment.status
    };
    
    await push(bookingRef, bookingData);
    
    console.log(`Added blog assignment to bookings for ${weekKey}`);
    return { success: true, bookingData };
    
  } catch (error) {
    console.error('Error adding blog to bookings:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sends notification for blog assignment
 * @param {Object} assignment - Assignment object
 * @returns {Promise<Object>} Notification result
 */
export async function sendBlogAssignmentNotification(assignment) {
  try {
    // For now, this is a placeholder for notification system
    // In production, this would integrate with email/WhatsApp APIs
    
    const notificationData = {
      type: 'blog_assignment',
      recipient: {
        name: assignment.assignee.name,
        number: assignment.assignee.number,
        userId: assignment.assignee.userId
      },
      message: `Hi ${assignment.assignee.name}! You've been assigned to write a blog post for week ${assignment.weekKey}. Deadline: ${new Date(assignment.deadline).toLocaleDateString()}`,
      assignmentDetails: {
        week: assignment.weekKey,
        role: 'blog',
        deadline: assignment.deadline,
        assignedAt: assignment.assignedAt
      },
      sentAt: new Date().toISOString()
    };
    
    // Log notification (in production, this would send actual notification)
    console.log('Blog assignment notification:', notificationData);
    
    // Store notification in Firebase for tracking
    const { ref, push } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
    // Note: database reference would need to be passed in for this to work
    // await push(ref(database, 'notifications'), notificationData);
    
    return {
      success: true,
      notificationData,
      method: 'logged' // In production: 'email', 'whatsapp', 'sms', etc.
    };
    
  } catch (error) {
    console.error('Error sending blog assignment notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Processes queued blog assignments (to be called periodically)
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Processing result
 */
export async function processQueuedBlogAssignments(database) {
  const { ref, get, remove } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    const queueRef = ref(database, 'blogQueue/pendingAssignments');
    const queueSnapshot = await get(queueRef);
    
    if (!queueSnapshot.exists()) {
      return { success: true, processed: 0, message: 'No queued assignments' };
    }
    
    const pendingAssignments = queueSnapshot.val();
    const results = [];
    let processed = 0;
    
    for (const [queueId, assignment] of Object.entries(pendingAssignments)) {
      try {
        // Check if it's time to process this assignment
        const scheduledTime = new Date(assignment.scheduledFor);
        const now = new Date();
        
        if (now >= scheduledTime) {
          // Attempt to assign
          const assignmentResult = await scheduleWednesdayBlogPosts(assignment.week, database);
          
          if (assignmentResult.success) {
            // Remove from queue
            await remove(ref(database, `blogQueue/pendingAssignments/${queueId}`));
            results.push({
              week: assignment.week,
              status: 'assigned',
              assignee: assignmentResult.selectedWriter?.name
            });
            processed++;
          } else {
            // Update attempt count
            const { update } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
            await update(ref(database, `blogQueue/pendingAssignments/${queueId}`), {
              attempts: (assignment.attempts || 0) + 1,
              lastAttempt: now.toISOString()
            });
            
            results.push({
              week: assignment.week,
              status: 'failed',
              reason: assignmentResult.reason,
              attempts: (assignment.attempts || 0) + 1
            });
          }
        }
      } catch (error) {
        console.error(`Error processing queued assignment ${queueId}:`, error);
        results.push({
          week: assignment.week,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return {
      success: true,
      processed,
      results,
      totalQueued: Object.keys(pendingAssignments).length
    };
    
  } catch (error) {
    console.error('Error processing queued blog assignments:', error);
    return {
      success: false,
      error: error.message,
      processed: 0
    };
  }
}

/**
 * Gets blog assignment status for a specific week
 * @param {string} weekKey - Week identifier
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Assignment status
 */
export async function getBlogAssignmentStatus(weekKey, database) {
  const { ref, get } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    const assignmentRef = ref(database, `blogAssignments/${weekKey}/wednesday`);
    const assignmentSnapshot = await get(assignmentRef);
    
    if (!assignmentSnapshot.exists()) {
      return {
        assigned: false,
        status: 'unassigned',
        weekKey
      };
    }
    
    const assignment = assignmentSnapshot.val();
    
    return {
      assigned: assignment.assigned,
      status: assignment.status,
      assignee: assignment.assignee,
      assignedAt: assignment.assignedAt,
      deadline: assignment.deadline,
      weekKey
    };
    
  } catch (error) {
    console.error('Error getting blog assignment status:', error);
    return {
      assigned: false,
      status: 'error',
      error: error.message,
      weekKey
    };
  }
}

/**
 * Removes a blog assignment (for admin use)
 * @param {string} weekKey - Week identifier
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Removal result
 */
export async function removeBlogAssignment(weekKey, database) {
  const { ref, get, remove } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    const assignmentRef = ref(database, `blogAssignments/${weekKey}/wednesday`);
    const assignmentSnapshot = await get(assignmentRef);
    
    if (!assignmentSnapshot.exists()) {
      return {
        success: false,
        error: 'No blog assignment found for this week'
      };
    }
    
    const assignment = assignmentSnapshot.val();
    
    // Remove from blog assignments
    await remove(assignmentRef);
    
    // Remove from main bookings
    const bookingRef = ref(database, `bookings/${weekKey}/Wednesday/blog`);
    const bookingSnapshot = await get(bookingRef);
    
    if (bookingSnapshot.exists()) {
      const bookings = bookingSnapshot.val();
      const bookingToRemove = Object.keys(bookings).find(key => 
        bookings[key].name === assignment.assignee.name
      );
      
      if (bookingToRemove) {
        await remove(ref(database, `bookings/${weekKey}/Wednesday/blog/${bookingToRemove}`));
      }
    }
    
    // Update assignment history (remove the assignment)
    const { removeAssignmentFromHistory } = await import('./break-logic.js');
    await removeAssignmentFromHistory(assignment.assignee.userId, weekKey, database);
    
    console.log(`Removed blog assignment for ${weekKey}`);
    
    return {
      success: true,
      removedAssignment: assignment,
      weekKey
    };
    
  } catch (error) {
    console.error('Error removing blog assignment:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Integrates blog automation with existing assignment workflow
 * This function should be called during the main auto-assignment process
 * @param {Array} weekKeys - Array of week identifiers to process
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Integration result
 */
export async function integrateBlogAutomationWithWorkflow(weekKeys, database) {
  try {
    const results = [];
    
    for (const weekKey of weekKeys) {
      // Check if it's Wednesday or if we need to assign for upcoming Wednesday
      const shouldAssignBlog = await shouldAssignBlogForWeek(weekKey);
      
      if (shouldAssignBlog) {
        const assignmentResult = await scheduleWednesdayBlogPosts(weekKey, database);
        results.push({
          weekKey,
          blogAssignment: assignmentResult
        });
      } else {
        results.push({
          weekKey,
          blogAssignment: { success: true, reason: 'Not time for blog assignment' }
        });
      }
    }
    
    // Process any queued assignments
    const queueResult = await processQueuedBlogAssignments(database);
    
    return {
      success: true,
      weekResults: results,
      queueProcessing: queueResult
    };
    
  } catch (error) {
    console.error('Error integrating blog automation with workflow:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Determines if a blog should be assigned for a given week
 * @param {string} weekKey - Week identifier
 * @returns {Promise<boolean>} Whether to assign blog
 */
async function shouldAssignBlogForWeek(weekKey) {
  try {
    // For now, assign blogs for all weeks
    // In production, this could check if it's actually Wednesday or near Wednesday
    const currentDate = new Date();
    const dayOfWeek = currentDate.getDay();
    
    // Assign on Wednesday (3) or if it's past Wednesday in the week
    return dayOfWeek >= 3;
    
  } catch (error) {
    console.error('Error checking if should assign blog:', error);
    return false;
  }
}

/**
 * Initializes blog automation schema in Firebase
 * @param {Object} database - Firebase database reference
 * @returns {Promise} Promise that resolves when initialization is complete
 */
export async function initializeBlogAutomationSchema(database) {
  const { ref, get, set } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
  
  try {
    // Initialize blog assignments structure
    const assignmentsRef = ref(database, 'blogAssignments');
    const assignmentsSnapshot = await get(assignmentsRef);
    
    if (!assignmentsSnapshot.exists()) {
      await set(assignmentsRef, {});
      console.log('Blog assignments schema initialized');
    }
    
    // Initialize blog writers structure
    const writersRef = ref(database, 'blogWriters');
    const writersSnapshot = await get(writersRef);
    
    if (!writersSnapshot.exists()) {
      await set(writersRef, {});
      console.log('Blog writers schema initialized');
    }
    
    // Initialize blog queue structure
    const queueRef = ref(database, 'blogQueue');
    const queueSnapshot = await get(queueRef);
    
    if (!queueSnapshot.exists()) {
      await set(queueRef, {
        pendingAssignments: {}
      });
      console.log('Blog queue schema initialized');
    }
    
    console.log('Blog automation schema initialization complete');
    
  } catch (error) {
    console.error('Error initializing blog automation schema:', error);
    throw error;
  }
}

/**
 * Gets comprehensive blog automation status
 * @param {Array} weekKeys - Array of week identifiers
 * @param {Object} database - Firebase database reference
 * @returns {Promise<Object>} Comprehensive status
 */
export async function getBlogAutomationStatus(weekKeys, database) {
  try {
    const status = {
      assignments: {},
      queue: {},
      writers: {},
      summary: {
        totalAssigned: 0,
        totalQueued: 0,
        totalWriters: 0
      }
    };
    
    // Get assignment status for each week
    for (const weekKey of weekKeys) {
      status.assignments[weekKey] = await getBlogAssignmentStatus(weekKey, database);
      if (status.assignments[weekKey].assigned) {
        status.summary.totalAssigned++;
      }
    }
    
    // Get queue status
    const { ref, get } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js");
    const queueRef = ref(database, 'blogQueue/pendingAssignments');
    const queueSnapshot = await get(queueRef);
    
    if (queueSnapshot.exists()) {
      status.queue = queueSnapshot.val();
      status.summary.totalQueued = Object.keys(status.queue).length;
    }
    
    // Get writers status
    const writersRef = ref(database, 'blogWriters');
    const writersSnapshot = await get(writersRef);
    
    if (writersSnapshot.exists()) {
      status.writers = writersSnapshot.val();
      status.summary.totalWriters = Object.keys(status.writers).length;
    }
    
    return status;
    
  } catch (error) {
    console.error('Error getting blog automation status:', error);
    return {
      error: error.message,
      assignments: {},
      queue: {},
      writers: {},
      summary: { totalAssigned: 0, totalQueued: 0, totalWriters: 0 }
    };
  }
}