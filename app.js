var _ = require ('lodash');

var xmppbot = require ('./bot-xmpp');
var config = require ('./config.json')['livecoding.tv'];
var bot = new xmppbot (config);

//
// To run this on the command line, make a config.json like so:
// {
//    "livecoding.tv": {
//       "domain": "chat.livecoding.tv",
//       "channel": "<streamer>",                  // username of the streamer to join their chat channel
//       "nickname": "<username>@livecoding.tv",   // the user the bot will appear as
//       "password": "<password>"                  // the bot users password
//       "followers-feed-url": 
//         "https://www.livecoding.tv/rss/longsteve/followers/?key=<your url feed key>"
//    }
// }
//
// Then simply "node app.js"
//

//
// Ideas for commands:
//   !spaces or !tabs
//


//
// RSS Feed reader for the followers
//

var FeedParser = require ('feedparser');
var request = require ('request');

var req = request (config ['followers-feed-url']);
var feedparser = new FeedParser ();

//
// Followers are saved in a json file
//
var jsonfile = require ('jsonfile')

// Load the currently known followers list from the json file
var file = __dirname + '/followers.json';

req.on('error', function (error) {
  // handle any request errors
});

req.on('response', function (res) {
  var stream = this;

  if (res.statusCode != 200) 
     return this.emit ('error', new Error('Bad status code'));

  stream.pipe (feedparser);
});

feedparser.on ('error', function (error) {
  // always handle errors
});

feedparser.on ('readable', function () {

  // This is where the action is!
  var stream = this;
  var item;

  var followers = [];

  while (item = stream.read ()) {
    followers.push (item.title);
  }

  // TODO: Don't do this sync
  var saved_followers = [];
  try {
    saved_followers = jsonfile.readFileSync (file);
  } catch (ex) {
    // Likely the file doesn't exist yet
    // console.log (ex);
  }

  // Are any of the entries in followers new
  var joined_since = _.difference (followers, _.map (saved_followers, "name"));
  if (joined_since.length > 0) {
     // new followers:
     console.log ("New follower: " + joined_since);

     _.each (followers, function (follower) {
        saved_followers.push ({
           name: follower,
           date: new Date
        });
     });
  }

  // Save the current set of followers
  jsonfile.writeFileSync (file, saved_followers);
});

//
// Save !rate values for each viewer
//

var ratings = {};

bot.on ('online', function (data) {
   var username = config.nickname.substring (0, config.nickname.indexOf ('@'));
   var channel = config.channel;
   console.log ('Joining the ' + channel + ' channel as ' + username);
   bot.join (channel, username);
});

bot.on ('error', function (e) {
   console.error ('error...');
   console.error (e);
});

bot.on( 'msg', function (nickname, channel, message, stanza) {
   console.log( nickname + ' said "' + message + '" in ' + channel );
});

bot.on( 'join', function (channel, nickname, stanza) {
   console.log (nickname + ' has joined channel ' + channel);
});

bot.on( 'command!cloc', function (channel, text, nickname, stanza) {
   // Run the cloc command on the source code and report the results
   var exec = require ('child_process').exec;
   var command = 'cloc --exclude-dir=node_modules,frameworks --exclude-lang=CMake --progress-rate=0 --csv --quiet .';
   console.log ("Running the cloc command");
   exec (command, function (error, stdout, stderr) { 

      if (error) {
         bot.message (channel, 'I\'m afraid there was an error with the !cloc command.');
         console.log (error);
      } else {         
         // The cloc command returns CSV like so:
         // files,language,blank,comment,code,"http://cloc.sourceforge.net v 1.60  T=0.05 s (38.1 files/s, 4226.8 lines/s)"
         // 2,Javascript,28,26,168
         try {
            var lines = stdout.split ('\n');

            var totals = {
               "sum": 0
            };
            for (var i = 0; i < lines.length - 1; i++) {
               var line = lines [i];
               if (line && line.length > 0) {
                  var spl = line.split (',');
                  var s = parseInt (spl [4]);
                  if (!isNaN (s)) {
                     totals [spl [1]] = s;
                     totals ["sum"] += s;
                  }
               }
            }

            var message = "The project is currently " + totals ["sum"] + " lines of code.";
            bot.message (channel, message);
         } catch (ex) {
            console.log (ex);
         }
      }
   });
});

bot.on( 'command!help', function (channel, text, nickname, stanza) {
   bot.message (channel, 'You can use the following commands:\n' +
                         '  !help   - Show this help\n' +
                         '  !rate N - Rate Steve (0-5)\n' +
                         '  !cloc   - Count lines of code');
});

bot.on( 'command!rate', function (channel, text, nickname, stanza) {
   var message;
   var calcRating = function () {
      var rating = 0;
      if (raters.length > 0) {
         var sum = 0;
         for (var i = 0; i < raters.length; i++) {
            sum += ratings [raters [i]];
         }
         rating = sum / raters.length;
      }
      return rating;
   };

   console.log ("Handling rate command");

   if (!text || !text.trim ()) {
      var raters = Object.keys (ratings);
      var rating = calcRating ();
      message = "Steve's rating is currently " + rating.toFixed (1) + "/5.0\n" + raters.length + " viewers have rated so far.";
   } else {
      try {
         var r = parseInt (text);
         if (isNaN (r)) {
            throw new Exception ("Nan");
         }
         if (r > 5) {
            r = 5.0;
         }
         ratings [nickname] = r;

         var raters = Object.keys (ratings);
         var rating = calcRating ();

         bot.message (channel, "Thanks " + nickname + " Steve really appreciates the feedback.");

         message = "Steve's new rating is " + rating.toFixed (1) + "/5.0\n" + raters.length + " viewers have rated so far.";
      } catch (ex) {
         message = "You need to supply a number between 0 and 5 to the !rate command.";
      }
   }

   bot.message (channel, message);
});

bot.on( 'part', function (channel, nickname, stanza) {
   //bot.message( channel, 'Goodbye' + nickname + '!', 'groupchat' );
   console.log (nickname + ' has left channel ' + channel);
});
