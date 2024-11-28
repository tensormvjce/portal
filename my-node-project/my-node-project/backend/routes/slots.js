const express = require('express');
const router = express.Router();
const Slot = require('portal\my-node-project\my-node-project\backend\models\slot.js');

// GET request for available slots
router.get('/', async (req, res) => {
    try {
        const slots = await Slot.find({ booked: false });
        res.json(slots);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST request to book a slot
router.post('/book', async (req, res) => {
    const { date, role } = req.body;
    
    try {
        const slot = await Slot.findOneAndUpdate(
            { date: date, role: role, booked: false },
            { booked: true },
            { new: true }
        );
        
        if (!slot) {
            return res.status(404).json({ message: 'Slot not available' });
        }
        
        res.json({ message: 'Slot booked successfully!', slot });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
