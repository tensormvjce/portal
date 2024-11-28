const mongoose = require('mongoose');

const SlotSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true
    },
    role: {
        type: String,
        required: true
    },
    booked: {
        type: Boolean,
        default: false
    }
});

const Slot = mongoose.model('Slot', SlotSchema);

module.exports = Slot;
