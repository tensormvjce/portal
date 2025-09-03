/**
 * Automated Notification System
 * Handles all notification types for the content scheduler
 */

class NotificationSystem {
    constructor() {
        this.notificationQueue = [];
        this.isProcessing = false;
        this.adminContacts = {
            email: 'admin@tensorclub.com',
            whatsapp: '+919876543210'
        };
    }

    /**
     * Send assignment notifications to users
     * @param {Array} assignments - Array of assignment objects
     */
    async sendAssignmentNotifications(assignments) {
        console.log('Sending assignment notifications:', assignments);
        
        for (const assignment of assignments) {
            try {
                const notification = {
                    type: 'assignment',
                    recipient: assignment.userId,
                    data: assignment,
                    timestamp: new Date().toISOString()
                };

                await this.queueNotification(notification);
                
                // Send immediate notification
                await this.sendUserNotification(assignment);
                
            } catch (error) {
                console.error('Failed to send assignment notification:', error);
                await this.logNotificationError(assignment, error);
            }
        }
    }

    /**
     * Send notification to individual user
     * @param {Object} assignment - Assignment details
     */
    async sendUserNotification(assignment) {
        const user = await this.getUserDetails(assignment.userId);
        if (!user) {
            throw new Error(`User not found: ${assignment.userId}`);
        }

        const message = this.formatAssignmentMessage(assignment, user);
        
        // Send via multiple channels
        const notifications = [];
        
        if (user.email) {
            notifications.push(this.sendEmail(user.email, 'Content Assignment', message));
        }
        
        if (user.whatsapp || user.number) {
            const phone = user.whatsapp || user.number;
            notifications.push(this.sendWhatsApp(phone, message));
        }

        await Promise.allSettled(notifications);
        
        // Log successful notification
        await this.logNotification({
            userId: assignment.userId,
            type: 'assignment',
            channels: ['email', 'whatsapp'],
            status: 'sent',
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Schedule deadline reminder notifications
     * @param {string} weekKey - Week identifier
     * @param {Date} deadline - Deadline date
     */
    async scheduleDeadlineReminders(weekKey, deadline) {
        const reminderTime = new Date(deadline.getTime() - (24 * 60 * 60 * 1000)); // 24 hours before
        
        if (reminderTime <= new Date()) {
            console.log('Deadline reminder time has passed, skipping');
            return;
        }

        const reminder = {
            type: 'deadline_reminder',
            weekKey: weekKey,
            deadline: deadline.toISOString(),
            reminderTime: reminderTime.toISOString(),
            scheduled: true
        };

        await this.scheduleNotification(reminder);
        console.log(`Deadline reminder scheduled for ${reminderTime.toISOString()}`);
    }

    /**
     * Send deadline reminder to all eligible users
     * @param {string} weekKey - Week identifier
     */
    async sendDeadlineReminders(weekKey) {
        console.log(`Sending deadline reminders for week: ${weekKey}`);
        
        try {
            const eligibleUsers = await this.getEligibleUsersForWeek(weekKey);
            const availableSlots = await this.getAvailableSlots(weekKey);
            
            if (availableSlots.length === 0) {
                console.log('No available slots, skipping deadline reminders');
                return;
            }

            const reminderMessage = this.formatDeadlineReminderMessage(weekKey, availableSlots);
            
            for (const user of eligibleUsers) {
                try {
                    await this.sendReminderToUser(user, reminderMessage);
                } catch (error) {
                    console.error(`Failed to send reminder to user ${user.id}:`, error);
                }
            }
            
            console.log(`Deadline reminders sent to ${eligibleUsers.length} users`);
            
        } catch (error) {
            console.error('Failed to send deadline reminders:', error);
            await this.notifyAdminOfError('deadline_reminder_failed', error);
        }
    }

    /**
     * Send admin notification for auto-assignment completion
     * @param {Object} assignmentResults - Results of auto-assignment
     */
    async sendAdminNotification(assignmentResults) {
        console.log('Sending admin notification for auto-assignment completion');
        
        const notification = {
            type: 'admin_auto_assignment',
            data: assignmentResults,
            timestamp: new Date().toISOString()
        };

        const message = this.formatAdminNotificationMessage(assignmentResults);
        
        try {
            // Send to admin email
            await this.sendEmail(this.adminContacts.email, 'Auto-Assignment Completed', message);
            
            // Send to admin WhatsApp
            await this.sendWhatsApp(this.adminContacts.whatsapp, message);
            
            // Log admin notification
            await this.logNotification({
                type: 'admin_notification',
                recipient: 'admin',
                status: 'sent',
                data: assignmentResults,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Failed to send admin notification:', error);
        }
    }

    /**
     * Format assignment message for users
     * @param {Object} assignment - Assignment details
     * @param {Object} user - User details
     * @returns {string} Formatted message
     */
    formatAssignmentMessage(assignment, user) {
        const { week, day, role, postType, assignmentType } = assignment;
        
        let message = `Hi ${user.name}!\n\n`;
        message += `You have been ${assignmentType === 'automatic' ? 'automatically ' : ''}assigned to:\n`;
        message += `📅 Week: ${week}\n`;
        message += `📆 Day: ${day}\n`;
        message += `👤 Role: ${role}\n`;
        
        if (postType) {
            message += `📝 Post Type: ${postType}\n`;
        }
        
        message += `\nPlease check the portal for more details.\n`;
        message += `Portal: https://tensor-portal.com\n\n`;
        message += `Thank you!\nTensor Club`;
        
        return message;
    }

    /**
     * Format deadline reminder message
     * @param {string} weekKey - Week identifier
     * @param {Array} availableSlots - Available slots
     * @returns {string} Formatted message
     */
    formatDeadlineReminderMessage(weekKey, availableSlots) {
        let message = `⏰ Deadline Reminder!\n\n`;
        message += `The deadline for ${weekKey} is approaching (24 hours remaining).\n\n`;
        message += `Available slots:\n`;
        
        availableSlots.forEach(slot => {
            message += `• ${slot.day} - ${slot.role}`;
            if (slot.postType) message += ` (${slot.postType})`;
            message += `\n`;
        });
        
        message += `\nPlease select your preferred slot before the deadline.\n`;
        message += `Portal: https://tensor-portal.com\n\n`;
        message += `Tensor Club`;
        
        return message;
    }

    /**
     * Format admin notification message
     * @param {Object} results - Assignment results
     * @returns {string} Formatted message
     */
    formatAdminNotificationMessage(results) {
        const { weekKey, assignedSlots, failedSlots, totalSlots } = results;
        
        let message = `🤖 Auto-Assignment Completed\n\n`;
        message += `Week: ${weekKey}\n`;
        message += `Total Slots: ${totalSlots}\n`;
        message += `Successfully Assigned: ${assignedSlots.length}\n`;
        message += `Failed Assignments: ${failedSlots.length}\n\n`;
        
        if (assignedSlots.length > 0) {
            message += `✅ Assigned Slots:\n`;
            assignedSlots.forEach(slot => {
                message += `• ${slot.day} ${slot.role} → ${slot.assignedUser}\n`;
            });
            message += `\n`;
        }
        
        if (failedSlots.length > 0) {
            message += `❌ Failed Assignments:\n`;
            failedSlots.forEach(slot => {
                message += `• ${slot.day} ${slot.role} - ${slot.reason}\n`;
            });
            message += `\n`;
        }
        
        message += `Portal: https://tensor-portal.com/admin`;
        
        return message;
    }    /
**
     * Send email notification
     * @param {string} email - Recipient email
     * @param {string} subject - Email subject
     * @param {string} message - Email message
     */
    async sendEmail(email, subject, message) {
        // In a real implementation, this would integrate with an email service
        // For now, we'll simulate the email sending
        console.log(`📧 Sending email to ${email}`);
        console.log(`Subject: ${subject}`);
        console.log(`Message: ${message}`);
        
        // Simulate email API call
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // Simulate 95% success rate
                if (Math.random() > 0.05) {
                    console.log(`✅ Email sent successfully to ${email}`);
                    resolve({ status: 'sent', channel: 'email', recipient: email });
                } else {
                    console.log(`❌ Email failed to send to ${email}`);
                    reject(new Error('Email delivery failed'));
                }
            }, 500);
        });
    }

    /**
     * Send WhatsApp notification
     * @param {string} phone - Recipient phone number
     * @param {string} message - WhatsApp message
     */
    async sendWhatsApp(phone, message) {
        // In a real implementation, this would integrate with WhatsApp Business API
        console.log(`📱 Sending WhatsApp to ${phone}`);
        console.log(`Message: ${message}`);
        
        // Simulate WhatsApp API call
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // Simulate 90% success rate
                if (Math.random() > 0.1) {
                    console.log(`✅ WhatsApp sent successfully to ${phone}`);
                    resolve({ status: 'sent', channel: 'whatsapp', recipient: phone });
                } else {
                    console.log(`❌ WhatsApp failed to send to ${phone}`);
                    reject(new Error('WhatsApp delivery failed'));
                }
            }, 300);
        });
    }

    /**
     * Get user details from Firebase
     * @param {string} userId - User ID
     * @returns {Object} User details
     */
    async getUserDetails(userId) {
        try {
            // Check content team first
            const contentRef = firebase.database().ref(`members/content/${userId}`);
            const contentSnapshot = await contentRef.once('value');
            
            if (contentSnapshot.exists()) {
                return {
                    id: userId,
                    team: 'content',
                    ...contentSnapshot.val()
                };
            }
            
            // Check design team
            const designRef = firebase.database().ref(`members/design/${userId}`);
            const designSnapshot = await designRef.once('value');
            
            if (designSnapshot.exists()) {
                return {
                    id: userId,
                    team: 'design',
                    ...designSnapshot.val()
                };
            }
            
            return null;
            
        } catch (error) {
            console.error('Error fetching user details:', error);
            return null;
        }
    }

    /**
     * Get eligible users for a specific week
     * @param {string} weekKey - Week identifier
     * @returns {Array} Eligible users
     */
    async getEligibleUsersForWeek(weekKey) {
        try {
            const eligibleUsers = [];
            
            // Get content team members
            const contentRef = firebase.database().ref('members/content');
            const contentSnapshot = await contentRef.once('value');
            
            if (contentSnapshot.exists()) {
                const contentMembers = contentSnapshot.val();
                for (const [userId, userData] of Object.entries(contentMembers)) {
                    if (await this.isUserEligible(userId, weekKey)) {
                        eligibleUsers.push({
                            id: userId,
                            team: 'content',
                            ...userData
                        });
                    }
                }
            }
            
            // Get design team members
            const designRef = firebase.database().ref('members/design');
            const designSnapshot = await designRef.once('value');
            
            if (designSnapshot.exists()) {
                const designMembers = designSnapshot.val();
                for (const [userId, userData] of Object.entries(designMembers)) {
                    if (await this.isUserEligible(userId, weekKey)) {
                        eligibleUsers.push({
                            id: userId,
                            team: 'design',
                            ...userData
                        });
                    }
                }
            }
            
            return eligibleUsers;
            
        } catch (error) {
            console.error('Error getting eligible users:', error);
            return [];
        }
    }

    /**
     * Check if user is eligible for assignment in a specific week
     * @param {string} userId - User ID
     * @param {string} weekKey - Week identifier
     * @returns {boolean} Eligibility status
     */
    async isUserEligible(userId, weekKey) {
        try {
            const historyRef = firebase.database().ref(`userAssignmentHistory/${userId}`);
            const snapshot = await historyRef.once('value');
            
            if (!snapshot.exists()) {
                return true; // No history means eligible
            }
            
            const history = snapshot.val();
            const lastAssignedWeek = history.lastAssignedWeek;
            
            if (!lastAssignedWeek) {
                return true;
            }
            
            // Check if user was assigned in the previous week (break logic)
            const weekOrder = this.getWeekOrder();
            const currentWeekIndex = weekOrder.indexOf(weekKey);
            const lastWeekIndex = weekOrder.indexOf(lastAssignedWeek);
            
            // User is eligible if they weren't assigned in the immediately previous week
            return currentWeekIndex - lastWeekIndex > 1;
            
        } catch (error) {
            console.error('Error checking user eligibility:', error);
            return false;
        }
    }

    /**
     * Get available slots for a week
     * @param {string} weekKey - Week identifier
     * @returns {Array} Available slots
     */
    async getAvailableSlots(weekKey) {
        try {
            const slotsRef = firebase.database().ref(`assignmentQueue/${weekKey}/pendingSlots`);
            const snapshot = await slotsRef.once('value');
            
            if (!snapshot.exists()) {
                return [];
            }
            
            const slots = snapshot.val();
            return Object.values(slots).filter(slot => 
                slot.currentAssignees < slot.maxAssignees
            );
            
        } catch (error) {
            console.error('Error getting available slots:', error);
            return [];
        }
    }

    /**
     * Send reminder to individual user
     * @param {Object} user - User details
     * @param {string} message - Reminder message
     */
    async sendReminderToUser(user, message) {
        const notifications = [];
        
        if (user.email) {
            notifications.push(
                this.sendEmail(user.email, 'Deadline Reminder - Content Assignment', message)
            );
        }
        
        if (user.whatsapp || user.number) {
            const phone = user.whatsapp || user.number;
            notifications.push(this.sendWhatsApp(phone, message));
        }
        
        await Promise.allSettled(notifications);
    }

    /**
     * Queue notification for processing
     * @param {Object} notification - Notification object
     */
    async queueNotification(notification) {
        this.notificationQueue.push(notification);
        
        // Store in Firebase for persistence
        const queueRef = firebase.database().ref('notificationQueue').push();
        await queueRef.set(notification);
        
        if (!this.isProcessing) {
            this.processNotificationQueue();
        }
    }

    /**
     * Schedule notification for future delivery
     * @param {Object} notification - Notification to schedule
     */
    async scheduleNotification(notification) {
        const scheduledRef = firebase.database().ref('scheduledNotifications').push();
        await scheduledRef.set(notification);
        
        console.log('Notification scheduled:', notification);
    }

    /**
     * Process notification queue
     */
    async processNotificationQueue() {
        if (this.isProcessing || this.notificationQueue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        
        while (this.notificationQueue.length > 0) {
            const notification = this.notificationQueue.shift();
            
            try {
                await this.processNotification(notification);
            } catch (error) {
                console.error('Error processing notification:', error);
            }
        }
        
        this.isProcessing = false;
    }

    /**
     * Process individual notification
     * @param {Object} notification - Notification to process
     */
    async processNotification(notification) {
        console.log('Processing notification:', notification.type);
        
        switch (notification.type) {
            case 'assignment':
                // Already processed in sendAssignmentNotifications
                break;
            case 'deadline_reminder':
                await this.sendDeadlineReminders(notification.weekKey);
                break;
            case 'admin_auto_assignment':
                await this.sendAdminNotification(notification.data);
                break;
            default:
                console.warn('Unknown notification type:', notification.type);
        }
    }

    /**
     * Log notification for audit trail
     * @param {Object} logData - Log data
     */
    async logNotification(logData) {
        try {
            const logRef = firebase.database().ref('notificationLogs').push();
            await logRef.set(logData);
        } catch (error) {
            console.error('Error logging notification:', error);
        }
    }

    /**
     * Log notification error
     * @param {Object} assignment - Assignment that failed
     * @param {Error} error - Error details
     */
    async logNotificationError(assignment, error) {
        const errorLog = {
            type: 'notification_error',
            assignment: assignment,
            error: error.message,
            timestamp: new Date().toISOString()
        };
        
        try {
            const errorRef = firebase.database().ref('notificationErrors').push();
            await errorRef.set(errorLog);
        } catch (logError) {
            console.error('Error logging notification error:', logError);
        }
    }

    /**
     * Notify admin of system errors
     * @param {string} errorType - Type of error
     * @param {Error} error - Error details
     */
    async notifyAdminOfError(errorType, error) {
        const message = `🚨 System Error Alert\n\n`;
        message += `Error Type: ${errorType}\n`;
        message += `Error: ${error.message}\n`;
        message += `Time: ${new Date().toISOString()}\n\n`;
        message += `Please check the system logs for more details.`;
        
        try {
            await this.sendEmail(this.adminContacts.email, 'System Error Alert', message);
            await this.sendWhatsApp(this.adminContacts.whatsapp, message);
        } catch (notificationError) {
            console.error('Failed to notify admin of error:', notificationError);
        }
    }

    /**
     * Get week order for break logic calculations
     * @returns {Array} Ordered list of weeks
     */
    getWeekOrder() {
        // This should match the week generation logic from automated-date-range.js
        return [
            'Sep1-Sep7', 'Sep8-Sep14', 'Sep15-Sep21', 'Sep22-Sep28',
            'Sep29-Oct5', 'Oct6-Oct12', 'Oct13-Oct19', 'Oct20-Oct26',
            'Oct27-Nov2', 'Nov3-Nov9', 'Nov10-Nov16', 'Nov17-Nov23',
            'Nov24-Nov30', 'Dec1-Dec7', 'Dec8-Dec14', 'Dec15-Dec21',
            'Dec22-Dec28', 'Dec29-Jan4', 'Jan5-Jan11', 'Jan12-Jan18',
            'Jan19-Jan25', 'Jan26-Feb1', 'Feb2-Feb8', 'Feb9-Feb15',
            'Feb16-Feb22', 'Feb23-Mar1', 'Mar2-Mar8', 'Mar9-Mar15',
            'Mar16-Mar22', 'Mar23-Mar29', 'Mar30-Apr5', 'Apr6-Apr12',
            'Apr13-Apr19', 'Apr20-Apr26', 'Apr27-May3', 'May4-May10'
        ];
    }

    /**
     * Check and process scheduled notifications
     */
    async checkScheduledNotifications() {
        try {
            const scheduledRef = firebase.database().ref('scheduledNotifications');
            const snapshot = await scheduledRef.once('value');
            
            if (!snapshot.exists()) {
                return;
            }
            
            const scheduled = snapshot.val();
            const now = new Date();
            
            for (const [key, notification] of Object.entries(scheduled)) {
                const reminderTime = new Date(notification.reminderTime);
                
                if (now >= reminderTime && !notification.processed) {
                    console.log('Processing scheduled notification:', notification.type);
                    
                    await this.processNotification(notification);
                    
                    // Mark as processed
                    await scheduledRef.child(key).update({ processed: true });
                }
            }
            
        } catch (error) {
            console.error('Error checking scheduled notifications:', error);
        }
    }

    /**
     * Initialize notification system
     */
    init() {
        console.log('Notification system initialized');
        
        // Check for scheduled notifications every minute
        setInterval(() => {
            this.checkScheduledNotifications();
        }, 60000);
        
        // Process any queued notifications
        this.processNotificationQueue();
    }
}

// Export for use in other modules
window.NotificationSystem = NotificationSystem;

// Initialize global instance
window.notificationSystem = new NotificationSystem();