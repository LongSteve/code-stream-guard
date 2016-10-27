//
// Main entry point for the bot app.  You can use the command line:
//
//   node app
//
// then point a web browser to http://localhost:3000 to get the front end
// UI panels.  However, you can also run the app using Node Webkit, using
// the included ./run command, or:
//
//   ./node_modules/nw/bin/nw .
//

//
// I'm tryng to move to Lodash from underscore!
//
var _ = require ('lodash');

//
// jsonfile for saving data
//
var jsonfile = require ('jsonfile');

//
// Logging with Winston
//
var winston = require ('winston');

//
// Minimist for command line arg parsing
//
var argv = require ('minimist') (process.argv.slice(2));

// Remove the default console logger
winston.remove(winston.transports.Console);

//
// Custom log levels
//
var CustomLevels = {
   levels: {
      error: 0, warn: 1, info: 2, verbose: 3, debug: 4, silly: 5
   },
   colors: {
      error: 'red', warn: 'yellow', info: 'green', verbose: 'magenta', debug: 'blue', silly: 'grey'
   }
};

// Custom console logger for startup messages
var consoleLogger = new (winston.transports.Console)({
   name: "console",
   level: (argv.debug && 'debug') || argv.log_level || 'info',
   timestamp: false,
   colorize: true,
   json: false
});

// File logger for all 'log level' messages
var fileLogger = new (winston.transports.File)({
   name: "file",
   level: 'debug',
   timestamp: true,
   colorize: false,
   json: false,
   filename: __dirname + '/debug.log'
});

winston.add (consoleLogger, {}, true);
winston.add (fileLogger, {}, true);

winston.setLevels (CustomLevels.levels);
winston.addColors (CustomLevels.colors);

//
// Get the config settings and strings
//
var config = require ('./config.js');
config.init ('livecoding.tv');

var strings = require ('./strings.js');
strings.init ();

//
// The avatar url fetcher class
//
var Avatar = require ('./avatar.js');

//
// Start the web (and websocket) server
//
var server = require ('./server.js');
var socket = null;
server.on ('connected', function (_socket) {
   socket = _socket;
});

server.on ('disconnected', function (_socket) {
   if (socket === _socket) {
      socket = null;
   }
});

//
// Kick off the follower feed checking
//
var followers = require ('./followers.js');

//
// Attach to the chat channel and monitor/respond as a bot
//
var chatter = require ('./chatter.js');

// The followed event is emitted, passed with an array of follower names
followers.on ('followed', function (followers) {
   winston.info ('New followers: ' + followers);
   followers.forEach (function (f) {
      chatter.sendMessage (strings.get ('chat-new-follower', {'name': f}));

      if (socket) {
         var av = new Avatar ();
         av.requestImage (f, function requestImageCallback (error, image_url) {
            server.toClient (socket, 'new follower', {
               'nickname': f,
               'image_url': image_url,
               'message': strings.get ('frontend-latest-follower', {'name': f})
            });
         });
      }
   });
});

// The unfollowed event is emitted, with an array of follower names
followers.on ('unfollowed', function (followers) {
   winston.info ('Unfollowed: ' + followers);
   followers.forEach (function (f) {
      chatter.sendMessage (strings.get ('chat-unfollowed', {'name': f}));
   });
});

// Store a map of viewers for the session (in memory)
var viewers = {};

// The joined event is emitted with a single nickname
chatter.on ('joined', function (nickname) {

   winston.info ((followers.isFollower (nickname) ? 'Follower ': '') + nickname + ' joined the chat room');

   var now = new Date;
   if (viewers [nickname]) {
      viewers [nickname].join_count++;
      viewers [nickname].last_joined = now;
   } else {
      // Not seen this viewer before
      viewers [nickname] = {
         first_joined: now,
         last_joined: now,
         last_left: null,
         join_count: 1,
         last_greeted_at: null,
         avatar_last_shown_at: null,
         greeting_timer: null
      };
   }

   winston.debug (nickname + " seen " + viewers [nickname].join_count + "time(s), first joined at: " + viewers [nickname].join_count);

   // Set the timer for default 3 seconds that announces new joiners.  The timeout is so that
   // anyone joining and leaving very quickly doesn't spam the announcement
   var timeout = config ['greenting-timeout'] || 3000;

   // Greeting timer already set?
   if (viewers [nickname].greeting_timer) {
      winston.warn ("Greeting timer already running for: " + nickname);
      return;
   }

   var greet = function delayedGreet (name) {
      return function greetNow () {

         var isFollower = followers.isFollower (name);

         // Clear the saved timer
         viewers [name].greeting_timer = null;

         var greetDate = new Date;  // don't use now, it'll be 3 seconds behind!

         if (nickname !== config.channel) {
            if (viewers [name].last_greeted_at) {
               winston.info ("Already greeted " + name + " at " + viewers [name].last_greeted_at);
            } else {
               winston.info ("Sending greetings to " + name);
               chatter.sendMessage (strings.get (isFollower ? 'chat-welcome-follower' : 'chat-welcome-normal', { 'name': name }));
               viewers [name].last_greeted_at = greetDate;
            }
         }

         if (socket) {
            if (!isFollower && viewers [name].avatar_last_shown_at) {
               winston.info ("Already shown avatar for " + name + " at " + viewers [name].avatar_last_shown_at);
            } else {
               var av = new Avatar ();
               av.requestImage (name, function requestImageCallback (error, image_url) {
                  winston.info ("Showing greeting avatar for " + name);
                  server.toClient (socket, 'new joiner', {
                     'nickname': name,
                     'image_url': image_url,
                     'message': strings.get ('frontend-welcome', {'name': name}),
                     'isFollower': isFollower
                  });
                  viewers [name].avatar_last_shown_at = new Date;    // new date, since image url request takes some time
               });
            }
         }
      };
   };

   winston.debug ("Setting greeting timer " + timeout + " for " + nickname);
   viewers [nickname].greeting_timer = setTimeout (greet (nickname), timeout);

});

// The left event is emitted with a single nickname
chatter.on ('left', function (nickname) {
   winston.info (nickname + ' left the chat room');
      if (viewers [nickname]) {
         viewers [nickname].last_left = new Date;
         if (viewers [nickname].greeting_timer) {
            winston.debug ("Cancelling greeting timer for " + nickname);
            clearTimeout (viewers [nickname].greeting_timer);
            viewers [nickname].greeting_timer = null;
         }
      }
   });

// Someone has rated, send a message to the UI to display it
chatter.on ('rating', function (event) {
   winston.info (event.nickname + ' has given a rating: ' + event.rating);
   if (socket) {
      server.toClient (socket, 'new rating', {'percent': event.rating});
   }
});

//
// Handle CTRL-C and send the goodbye message to the chat room
//
process.on ('SIGINT', function () {
    winston.info ("Caught interrupt signal, exiting");
    if (chatter) {
       chatter.sendMessage (strings.get ('chat-bot-leaving'));
    }

    // Save the viewers data as json file, for later inspection
    jsonfile.writeFile ("viewers.json", viewers, function wroteJsonViewersFile () {
       winston.debug ("Saved viewers.json");
       // Delay the exit by a few millis to give the message time to be sent
       setTimeout (function () {
          process.exit ();
       }, 200);
    });
});
