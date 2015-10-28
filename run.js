var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/numbers');
var Post = require('./Post');
var Screwed = require('./Screwed');
var User = require('./User');
var cronJob = require("cron").CronJob;
var plotly = require('plotly')("USER", "KEY");
var numToText = require('numtotext')

var WebSocket = require('ws'),
    apiToken = "", //Api Token from https://api.slack.com/web (Authentication section)
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

  // keep presence
  new cronJob("00 */30 * * * *", function() {
      updatePresence(ws)
  }, null, true).start();

  ws.on('open', function() {
      console.log('Connected');
  });

  ws.on('message', function(message) {
      message = JSON.parse(message);

      // console.log(JSON.stringify(message))

      if (message.type === 'message') {
        // numbers channel
        if (message.channel === channelId) {
          handleMessageToNumbersChannel(ws, message)
        }
        else if (message.channel === statsChannel && (message.text === "numbers-stats" || message.text === "stats")) {
          stats(ws)
        }
        else if (message.channel === statsChannel && (message.text === "topcagadas?" || message.text === "cagadas?")) {
            topCagadas(ws)
        }
        else if (message.channel === statsChannel && message.text === "next") {
            var expecting = lastNumber == null ? "No se che, recién arranqué o me perdí :(" : ("El próximo que espero es  " + (lastNumber + 1))
            ws.send(JSON.stringify({ channel: statsChannel, id: 1, text: expecting, type: "message" }));
        }
        else if (message.channel === statsChannel && message.text === "chart") {
            chart(ws)
        }
        else if (message.channel === statsChannel && message.text === "reset") {
               lastNumber = null
        }
      }
  });
}

function handleMessageToNumbersChannel(ws, message) {
    var withoutMentions = removeMentions(message.text)
    
    if (withoutMentions.match(/\d+/)) {
      // a number !
      var supposed = lastNumber + 1
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
           var mention = toMention(userName)
           ws.send(JSON.stringify({ channel: statsChannel, id: 1, text: "La cagaste " + mention + "! Posteaste dos numeros seguidos !", type: "message" }));
        })

        saveScrewedUp(message.user, number, 'eco', supposed)
        lastNumber = 0
        return
      }

      if (lastNumber != null && number != lastNumber + 1) {     
        
        withUserName(message.user, function(userName) { 
          var mention = toMention(userName)
          ws.send(JSON.stringify({ channel: statsChannel, id: 1, text: "La cagaste " + mention + "! numero incorrecto ! Tenias que haber puesto " + numToText(supposed) + " y pusiste " + numToText(number), type: "message" }));
        })

        saveScrewedUp(message.user, number, 'wrongSequence', supposed)
        lastNumber = 0
        return
      }
      
      askForUserName(ws, message)

      savePost(message, lastNumber)

      lastNumber = number
      lastAuthor = message.user
    }
    else if (message.text.match(/^soy .*$/)) {
      var name = /^soy (.*)$/.exec(message.text)[1]
      saveUserName(message.user, name)
    }
    else if (message.subtype == "channel_join") {
      var who = parseMention(message.text)
      ws.send(JSON.stringify({ channel: channelId, id: 1, text: "Bienvenido <@" + who + ">! Tratá de no cagarla mucho !", type: "message" }));
    }
    else if (message.edited) {
      withUserName(message.user, function(userName) { 
           var mention = toMention(userName)
           ws.send(JSON.stringify({ channel: statsChannel, id: 1, text: "La cagaste " + mention + "! Editaste un mensaje !!!", type: "message" }));
      })
      saveScrewedUp(message.user, 0, 'edited', supposed)
    }
}

function toMention(nameOrId) {
  if (nameOrId.match(/\d+/)) {
    //id
    return "<@" + nameOrId + ">"
  }
  else {
    return nameOrId
  }
} 

function parseMention(text) {
  return text.substring(text.indexOf('@<') + 2, text.indexOf('>'))
}

function saveUserName(userId, name) {
  User.findOne({'code' : userId}, function(err, user) {
    if (!user) {
      user = new User()
      user.code = userId
      user.name = name
    }
    user.name = name
    user.save(function (err, saveResult) {
      console.log("Saved user " + userId + " -> " + name)
    })
  })
}

function askForUserName(ws, userId) {
  withUserName(userId, function(userName) {
    if (userName === userId) {
      ws.send(JSON.stringify({ channel: channelId, id: 1, text: "Quien sos <@" + userId + "> ? (contestame con \"Soy xxx\"", type: "message" }));
    }
  })
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
    if (err) return code
    cb((user != null) ? user.name : code)
  });
}

function withUsers(codes, cb) {
  User.find({ 'code': { "$in" : codes } }, function (err, users) {
    if (err) throw err;
    cb(users)
  });
}

function saveScrewedUp(user, postedNumber, cause, lastNumber) {
 Screwed({
    user: user,
    postedNumber: postedNumber,
    lastNumber: lastNumber,
    cause: cause
  }).save(function(err) {
    if (err) throw err;
    console.log('Screwed (' + user + ", " + lastNumber + ", " + cause + ")");
  }); 
}


function stats(ws) {
  withStats(function(stats) {
    sendStats(ws, stats)    
  })
}

function topCagadas(ws) {
  withCagadas(function(stats) {
    sendStats(ws, stats)
  })
}

function sendStats(ws, stats) {
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

function withCagadas(cb) {
  Screwed.aggregate([{$group : { _id : "$user", count: { $sum: 1 }}}, { $sort : { count : -1 } }], function(err, result) {
      if (err) {
        console.log(err);
        return;
      }
      cb(result)
  })
}

function chart(ws) {
  chartData(function(data) {
     processChartData(data, function() {
        result = data
        ws.send(JSON.stringify({ channel: statsChannel, id: 1, text: "Messages by day https://plot.ly/~javierscvsoft/2.png", type: "message" }));
     })
  })
}

function chartData(cb) {
    Post.aggregate([
      {$group: { 
        _id: {
            year : { $year : "$date" },        
            month : { $month : "$date" },        
            day : { $dayOfMonth : "$date" },
        },
        count: { $sum: 1 }
      }}
      ], function(err, result) {
      if (err) {
        console.log(err);
        return;
      }

      cb(result)
  })
}

function processChartData(entries, then) {

  var dates = entries.map(function(e) { return e._id.year + "-" + e._id.month + "-" + e._id.day })
  var values = entries.map(function(e) { return e.count })
  
  var data = [
  {
    x: dates,
    y: values,
    type: "scatter"
  }
  ];

  console.log("Chart for " + data)
  var graphOptions = {filename: "count-by-day", fileopt: "overwrite"};
  plotly.plot(data, graphOptions, function (err, msg) {
      if (!err)
        then()
      console.log(msg);
  });
}

