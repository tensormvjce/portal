document.addEventListener('DOMContentLoaded', () => {
    // Fetch and display slots
    fetchSlots();

    // Event listener for form submission
    const bookingForm = document.getElementById('booking-form');
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const date = document.getElementById('date').value;
        const role = document.getElementById('role').value;

        try {
            const response = await fetch('https://your-app-name.onrender.com/slots/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date, role })
            });
            const data = await response.json();
            console.log('Slot booked:', data);
        } catch (error) {
            console.error('Error booking slot:', error);
        }
    });
});

async function fetchSlots() {
    try {
        const response = await fetch('https://your-app-name.onrender.com/slots');
        const slots = await response.json();
        displaySlots(slots);
    } catch (error) {
        console.error('Error fetching slots:', error);
    }
}

function displaySlots(slots) {
    const slotsContainer = document.getElementById('slots-container');
    slotsContainer.innerHTML = '';
    slots.forEach(slot => {
        const slotDiv = document.createElement('div');
        slotDiv.textContent = `${slot.date} - ${slot.role} - ${slot.booked ? 'Booked' : 'Available'}`;
        slotsContainer.appendChild(slotDiv);
    });
}
