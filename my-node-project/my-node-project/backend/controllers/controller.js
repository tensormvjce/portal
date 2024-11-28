const Slot = require('../models/Slot');

// Function to get all slots
exports.getSlots = async (req, res) => {
    try {
        const slots = await Slot.find();
        res.json(slots);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Function to create a slot
exports.createSlot = async (req, res) => {
    const { date, role } = req.body;
    const slot = new Slot({ date, role });

    try {
        const newSlot = await slot.save();
        res.status(201).json(newSlot);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Function to update a slot
exports.updateSlot = async (req, res) => {
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
};

// Function to delete a slot
exports.deleteSlot = async (req, res) => {
    try {
        const slot = await Slot.findByIdAndDelete(req.params.id);
        if (!slot) {
            return res.status(404).json({ message: 'Slot not found' });
        }
        res.json({ message: 'Slot deleted' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
