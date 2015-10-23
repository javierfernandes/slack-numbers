var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/numbers');
var Post = require('./Post');
var Screwed = require('./Screwed');
var User = require('./User');

var WebSocket = require('ws'),
    apiToken = "<< YOURS HERE >>", //Api Token from https://api.slack.com/web (Authentication section)
    authUrl = "https://slack.com/api/rtm.start?token=" + apiToken,
    request = require("request"),
    userId = 'U03C73RAE', // Id for the user the bot is posting as
    channelId = 'G069T2UV9'; // numbers channel

var botsChannel = 'G06E6NZ89'
var statsChannel = 'G0D3S1WQK'

request(authUrl, function(err, response, body) {
  if (!err && response.statusCode === 200) {
    var res = JSON.parse(body);
    if (res.ok) {
      connectWebSocket(res.url);
    }
  }
});

var lastNumber = null
var lastAuthor = null
var lastMessageId = null

function connectWebSocket(url) {
  var ws = new WebSocket(url);

  ws.on('open', function() {
      console.log('Connected');
  });

  ws.on('message', function(message) {
      message = JSON.parse(message);

      // console.log(JSON.stringify(message))

      if (message.type === 'message' && message.edited === undefined)
        if (message.channel === channelId) {

          // a number
          var withoutMentions = removeMentions(message.text)
          if (withoutMentions.match(/\d+/)) {
            var number = Number(withoutMentions.match(/\d+/)[0]) // gets the first one ?

            console.log("Found a number in message " + withoutMentions)

            if (!number) return;

            if (isTooOld(message)) {
              console.log('message is too old ' + JSON.stringify(message))
              return;
            }
            if (lastAuthor != null && message.user == lastAuthor && lastMessageId != null && mesasge.id != lastMessageId) {
              console.log("la cago " + message.user + " secuencia incorrecta")

              withUserName(message.user, function(userName) { 
                 ws.send(JSON.stringify({ channel: botsChannel, id: 1, text: "La cagaste " + userName + "! Posteaste dos numeros seguidos !", type: "message" }));
              })

              saveScrewedUp(message.user, number, 'eco')
              lastNumber = 0
              return
            }

            if (lastNumber != null && number != lastNumber + 1) {
              console.log("la cago: secuencia incorrecta")
              
              withUserName(message.user, function(userName) { 
                ws.send(JSON.stringify({ channel: botsChannel, id: 1, text: "La cagaste " + userName + "! numero incorrecto ! Tenias que haber puesto " + (lastNumber +1) + " y pusiste " + number, type: "message" }));
              })

              saveScrewedUp(message.user, number, 'wrongSequence')
              lastNumber = 0
              return
            }
            
            savePost(message, lastNumber)

            lastNumber = number
            lastAuthor = message.user
          }
          else if (message.text.match(/^perdio @<.*>/)) {
            var who = message.text.substring(message.text.indexOf('@<') + 2, message.text.indexOf('>'))
            saveScrewedUp(message, 0, 'perdio')
          }
        }
      else if (message.channel === statsChannel && message.text === "numbers-stats") {
          stats(ws)
      }
  });
}

function removeMentions(text) {
  var matches = text.match(/<@.*>/)
  if (matches != null) {
    matches.forEach(function(mention) {
      text = text.replace(mention, '')
    })
  }
  return text
}

function isTooOld(message) {
  var date = new Date(message.ts.substring(0, message.ts.indexOf('.')) * 1000);
  var now = new Date()
  
  var elapsedSeconds = (now.getTime() - date.getTime()) / 1000

  return elapsedSeconds > 20
}

function savePost(message, number) {
  Post({
    user: message.user
  }).save(function(err) {
    if (err) throw err;

    withUserName(message.user, function(userName) { 
      console.log('Post (' + userName + ", " + number + ")");  
    })
  });
}

function withUserName(code, cb) {
  User.findOne({ 'code': code }, function (err, user) {
    if (err) throw err;
    cb((user != null) ? user.name : code)
  });
}

function withUsers(codes, cb) {
  User.find({ 'code': { "$in" : codes } }, function (err, users) {
    if (err) throw err;
    cb(users)
  });
}

function saveScrewedUp(user, lastNumber, cause) {
 Screwed({
    user: user,
    lastNumber: lastNumber,
    cause: cause
  }).save(function(err) {
    if (err) throw err;
    console.log('Screwed (' + user + ", " + lastNumber + ", " + cause + ")");
  }); 
}


function stats(ws) {
  withStats(function(stats) {
    var userCodes = stats.map(function(stat) { return stat._id })

    withUsers(userCodes, function(users) {
        var entries = stats.map(function(stat) {
           var entry = { 
                user : findUserName(users, stat._id),
                messages : stat.count
           }
           return entry.user + " : " + entry.messages
        })

        ws.send(JSON.stringify({ channel: statsChannel, id: 1, text: "Stats ```" + entries.join("\n") + "```", type: "message" }));
    })
  })
}

function findUserName(users, userCode) {
  var l = users.length;
  for (var i = 0; i < l; i++) {
    var user = users[i]
    if (user.code == userCode)
      return user.name
  }
  return userCode
}

function withStats(cb) {
  Post.aggregate([{$group : { _id : "$user", count: { $sum: 1 }}}, { $sort : { count : -1 } }], function(err, result) {
      if (err) {
        console.log(err);
        return;
      }
      cb(result)
  })
}

