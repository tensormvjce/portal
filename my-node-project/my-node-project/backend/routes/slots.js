const express = require('express');
const router = express.Router();
const Slot = require('portal\my-node-project\my-node-project\backend\models\slot.js');

// Get all slots
router.get('/', async (req, res) => {
    try {
        const slots = await Slot.find();
        res.json(slots);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create a slot
router.post('/create', async (req, res) => {
    const { date, role } = req.body;
    const slot = new Slot({ date, role });

    try {
        const newSlot = await slot.save();
        res.status(201).json(newSlot);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update a slot (e.g., booking it)
router.put('/:id', async (req, res) => {
    try {
        const slot = await Slot.findById(req.params.id);
        if (!slot) {
            return res.status(404).json({ message: 'Slot not found' });
        }

        slot.booked = true;
        const updatedSlot = await slot.save();
        res.json(updatedSlot);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete a slot
router.delete('/:id', async (req, res) => {
    try {
        const slot = await Slot.findByIdAndDelete(req.params.id);
        if (!slot) {
            return res.status(404).json({ message: 'Slot not found' });
        }
        res.json({ message: 'Slot deleted' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
