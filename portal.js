const firebaseConfig = {
    apiKey: "AIzaSyBSbonwVE3PPXIIrSrvrB75u2AQ_B_Tni4",
    authDomain: "discraft-c1c41.firebaseapp.com",
    databaseURL: "https://discraft-c1c41-default-rtdb.firebaseio.com",
    projectId: "discraft-c1c41",
    storageBucket: "discraft-c1c41.firebasestorage.app",
    messagingSenderId: "525620150766",
    appId: "1:525620150766:web:a426e68d206c68764aceff",
    measurementId: "G-2TRNRYRX5E"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Reference to Firebase Realtime Database
const slotBookingDB = firebase.database().ref("slotBookings");

// Handle form submission
document.getElementById("slotBookingForm").addEventListener("submit", submitBookingForm);

// Submit booking form
function submitBookingForm(e) {
    e.preventDefault();

    const userName = getElementVal("userName");
    const selectedDateRange = getElementVal("dateRangeSelect");
    const selectedDay = getElementVal("daySelect");
    const selectedRole = getElementVal("roleSelect");

    // Check if the slot is already booked for this role on the selected day
    checkSlotAvailability(selectedDateRange, selectedDay, selectedRole, userName);
}

// Check if the slot is available
function checkSlotAvailability(dateRange, day, role, userName) {
    const slotRef = slotBookingDB.child(`${dateRange}/${day}/${role}`);

    slotRef.once("value", (snapshot) => {
        if (snapshot.exists()) {
            alert("This slot is already booked! Please choose another slot.");
        } else {
            saveBooking(userName, dateRange, day, role);
        }
    });
}

// Save booking to Firebase
function saveBooking(userName, dateRange, day, role) {
    const slotRef = slotBookingDB.child(`${dateRange}/${day}/${role}`);
    slotRef.set({
        userName: userName,
        dateRange: dateRange,
        day: day,
        role: role
    });

    document.querySelector(".alert").style.display = "block";

    setTimeout(() => {
        document.querySelector(".alert").style.display = "none";
    }, 3000);

    // Reset the form after booking
    document.getElementById("slotBookingForm").reset();

    // Reload availability data
    displaySlotAvailability();
}

// Helper function to get input values
function getElementVal(id) {
    return document.getElementById(id).value;
}

// Function to display availability for each date range
function displaySlotAvailability() {
    const slotAvailabilityContainer = document.getElementById("slotAvailability");
    const dateRanges = ["Nov23-Dec3", "Dec4-Dec10", "Dec11-Dec17"];

    // Clear previous availability data
    slotAvailabilityContainer.innerHTML = "";

    dateRanges.forEach(dateRange => {
        const dateRangeDiv = document.createElement("div");
        dateRangeDiv.classList.add("dateRangeDetails");

        const dateRangeTitle = document.createElement("h3");
        dateRangeTitle.innerText = dateRange.replace("-", " - ");
        dateRangeDiv.appendChild(dateRangeTitle);

        const slotList = document.createElement("ul");
        dateRangeDiv.appendChild(slotList);

        // Get data for this date range
        const slotRef = slotBookingDB.child(dateRange);
        slotRef.once("value", snapshot => {
            if (snapshot.exists()) {
                snapshot.forEach(daySnapshot => {
                    const dayName = daySnapshot.key; // "Friday" or "Sunday"
                    daySnapshot.forEach(roleSnapshot => {
                        const roleName = roleSnapshot.key; // "Content" or "Design"
                        const slotData = roleSnapshot.val();

                        const slotItem = document.createElement("li");
                        slotItem.innerText = `${dayName}: ${roleName} booked by ${slotData.userName}`;
                        slotList.appendChild(slotItem);
                    });
                });
            } else {
                const noSlotsMessage = document.createElement("li");
                noSlotsMessage.innerText = "No bookings yet for this date range.";
                slotList.appendChild(noSlotsMessage);
            }
        });

        slotAvailabilityContainer.appendChild(dateRangeDiv);
    });
}

// Call displaySlotAvailability to populate the availability on page load
window.onload = displaySlotAvailability;
