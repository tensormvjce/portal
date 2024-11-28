const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
    date: { type: String, required: true },
    role: { type: String, required: true, enum: ['content', 'design'] },
    booked: { type: Boolean, default: false }
});

module.exports = mongoose.model('Slot', slotSchema);
