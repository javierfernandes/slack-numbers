var mongoose = require('mongoose');


var Schema = mongoose.Schema;

var postSchema = new Schema({
  user: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

var Post = mongoose.model('Post', postSchema);


module.exports = Post;