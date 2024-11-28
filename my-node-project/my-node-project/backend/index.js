const express = require('express');
const mongoose = require('mongoose');
const slotRoutes = require('./routes/slotRoutes');
const app = express();

app.use(express.json());  // Middleware to parse JSON requests

// Connect to MongoDB Atlas
const mongoURI = process.env.MONGO_URI || 'mongodb+srv://<username>:<password>@cluster0.mongodb.net/your-db-name?retryWrites=true&w=majority';
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log(err));

// Use slot routes
app.use('/slots', slotRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
