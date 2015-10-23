var mongoose = require('mongoose');
var Schema = mongoose.Schema;


module.exports = mongoose.model('User', new Schema({
  		code: { type: String, required: true, unique: true },
  		name: { type: String, required: true }
	})
);