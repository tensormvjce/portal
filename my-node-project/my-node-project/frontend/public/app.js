// Fetch and display available slots
fetch('http://localhost:5000/slots')
  .then(response => response.json())
  .then(slots => {
    const slotsContainer = document.getElementById('slots-container');
    slots.forEach(slot => {
      const slotDiv = document.createElement('div');
      slotDiv.textContent = `${slot.date} - ${slot.role} - ${slot.booked ? 'Booked' : 'Available'}`;
      slotsContainer.appendChild(slotDiv);
    });
  })
  .catch(err => console.log('Error fetching slots:', err));

// Handle form submission to book a slot
const bookingForm = document.getElementById('booking-form');
bookingForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const date = document.getElementById('date').value;
  const role = document.getElementById('role').value;

  fetch('http://localhost:5000/slots/book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, role })
  })
    .then(response => response.json())
    .then(data => alert(data.message))
    .catch(err => console.log('Error booking slot:', err));
});
