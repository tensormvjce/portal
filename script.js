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

function submitBookingForm(e) {
    e.preventDefault();

    const userName = getElementVal("userName");
    const selectedWeek = getElementVal("weekSelect");
    const selectedDay = getElementVal("daySelect");
    const selectedRole = getElementVal("roleSelect");

    // Check if the slot is already booked
    checkSlotAvailability(selectedWeek, selectedDay, selectedRole, userName);
}

// Check if the slot is available
function checkSlotAvailability(week, day, role, userName) {
    const slotRef = slotBookingDB.child(`${week}/${day}/${role}`);

    slotRef.once("value", (snapshot) => {
        if (snapshot.exists()) {
            alert("This slot is already booked! Please choose another slot.");
        } else {
            saveBooking(userName, week, day, role);
        }
    });
}

// Save booking to Firebase
function saveBooking(userName, week, day, role) {
    const slotRef = slotBookingDB.child(`${week}/${day}/${role}`);
    slotRef.set({
        userName: userName,
        week: week,
        day: day,
        role: role
    });

    document.querySelector(".alert").style.display = "block";

    setTimeout(() => {
        document.querySelector(".alert").style.display = "none";
    }, 3000);

    document.getElementById("slotBookingForm").reset();
}

// Helper function to get input values
function getElementVal(id) {
    return document.getElementById(id).value;
}
