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
//    }
// }
//
// Then simply "node app.js"
//

// Save !rate values for each viewer
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
