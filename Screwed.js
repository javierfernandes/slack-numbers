var mongoose = require('mongoose');
var Schema = mongoose.Schema;


module.exports = mongoose.model('Screwed', new Schema({
  		user: { type: String, required: true },
  		lastNumber: Number,
  		cause: String,
  		date: { type: Date, default: Date.now }
	})
);
