//
// Main entry point for the bot app.  You can use the command line:
//
//   node app
//
// then point a web browser to http://localhost:3000 to get the front end
// UI panels.  However, you can also run the app using Electron, using
// the included ./run command, or:
//
//   ./node_modules/.bin/electron .
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
// Nothing else needed for date/time handing
//
var moment = require ('moment');

//
// Logging with Winston
//
var winston = require ('winston');

//
// Minimist for command line arg parsing
//
var argv = require ('minimist') (process.argv.slice(2));

//
// App-Root-Path seems like a good idea
//
var __approot = require('app-root-path');

// Remove the default console logger
winston.remove(winston.transports.Console);

//
// Some development time constants
//
var ENABLE_FOLLOWERS_FEED = true;
var ENABLE_CHAT_BOT = true;

//
// Electron Front End
//
var app = require('electron').app;  // Module to control application life.
var BrowserWindow = require('electron').BrowserWindow;  // Module to create native browser window.

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow = null;
var indicatorWindow = null;

// Quit when all windows are closed.
app.on('window-all-closed', function() {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform != 'darwin') {
        app.quit();
    }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on ('ready', function () {

   mainWindow = new BrowserWindow ({
     width: 920,
     height: 770,
     'min-width': 500,
     'min-height': 200,
     'accept-first-mouse': true,
     'title-bar-style': 'hidden'
   });

   mainWindow.loadURL ('http://localhost:3000/main.html');
   if (argv.debug) {
      mainWindow.webContents.openDevTools();
   }

   mainWindow.on ('closed', function() {
      if (indicatorWindow) {
         indicatorWindow.close ();
         indicatorWindow = null;
      }
      mainWindow = null;
   });
});

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
   filename: __approot + '/debug.log'
});

winston.add (consoleLogger, {}, true);
winston.add (fileLogger, {}, true);

winston.setLevels (CustomLevels.levels);
winston.addColors (CustomLevels.colors);

//
// Get the config settings and strings
//
var config = require (__approot + '/modules/config.js');
config.init ('livecoding.tv');

var strings = require (__approot + '/modules/strings.js');
strings.init ();

//
// The avatar url fetcher class
//
var Avatar = require (__approot + '/modules/avatar.js');

//
// Start the web (and websocket) server
//
var server = require (__approot + '/modules/server.js');

server.on ('window', function (_socket, data) {

   winston.verbose ("server window event");

   if (data.action == "close" && data.name == "indicator" && indicatorWindow) {
      winston.verbose ("Request to close indicator window");
      indicatorWindow.close ();
   }

   if (data.action == "show" && data.name == "indicator" && !indicatorWindow) {
      winston.verbose ("Request to show indicator window");

      var winOpts = {
         width: 240, 
         height: 420, 
         resizable: true,
         show: false
      };

      if (data.transparent) {
         winOpts.frame = false;
         winOpts.transparent = true;
      } else {
         winOpts.backgroundColor ="#000000";
      }

      // Create the browser window.
      indicatorWindow = new BrowserWindow (winOpts);

      // and load the index.html of the app.
      indicatorWindow.loadURL('http://localhost:3000/indicator.html');
      //indicatorWindow.webContents.openDevTools ();

      indicatorWindow.on ('ready-to-show', function () {
         indicatorWindow.show ();
         winston.verbose ("Indicator window shown");
         server.toClient ("window", {"name": "indicator", "event": "show"}, _socket);
      });

      // Emitted when the window is closed.
      indicatorWindow.on ('closed', function () {
          // Dereference the window object, usually you would store windows
          // in an array if your app supports multi windows, this is the time
          // when you should delete the corresponding element.

          winston.verbose ("Indicator window closed");

          server.toClient("window", { "name": "indicator", "event": "close" }, _socket);

          indicatorWindow = null;
      });
   }
});

//
// Kick off the follower feed checking
//

if (ENABLE_FOLLOWERS_FEED) {

   var followers = require (__approot + '/modules/followers.js');

   // The followed event is emitted, passed with an array of follower names
   followers.on ('followed', function (followers) {
      winston.info ('New followers: ' + followers);
      followers.forEach (function (f) {
         if (chatter) {
            chatter.sendMessage(strings.get('chat-new-follower', { 'name': f }));
         }

         var av = new Avatar ();
         av.requestImage (f, function requestImageCallback (error, image_url) {
            server.toClient ('new follower', {
               'nickname': f,
               'image_url': image_url,
               'message': strings.get ('frontend-latest-follower', {'name': f})
            });
         });
      });
   });

   // The unfollowed event is emitted, with an array of follower names
   followers.on ('unfollowed', function (followers) {
      winston.info ('Unfollowed: ' + followers);
      if (chatter) {
         followers.forEach(function(f) {
            chatter.sendMessage (strings.get ('chat-unfollowed', {'name': f}));
         });
      }
   });
}

if (ENABLE_CHAT_BOT) {

   //
   // Attach to the chat channel and monitor/respond as a bot
   //
   var chatter = require (__approot + '/modules/chatter.js');

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

            if (!isFollower && viewers [name].avatar_last_shown_at) {
               winston.info ("Already shown avatar for " + name + " at " + viewers [name].avatar_last_shown_at);
            } else {
               var av = new Avatar ();
               av.requestImage (name, function requestImageCallback (error, image_url) {
                  winston.info ("Showing greeting avatar for " + name);
                  server.toClient ('new joiner', {
                     'nickname': name,
                     'image_url': image_url,
                     'message': strings.get ('frontend-welcome', {'name': name}),
                     'isFollower': isFollower
                  });
                  viewers [name].avatar_last_shown_at = new Date;    // new date, since image url request takes some time
               });
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
      server.toClient ('new rating', {'percent': event.rating});
   });
}

//
// Handle CTRL-C and send the goodbye message to the chat room
//
process.on ('SIGINT', function () {
    winston.info ("Caught interrupt signal, exiting");
    if (chatter) {
       chatter.sendMessage (strings.get ('chat-bot-leaving'));
    }

    // Save the viewers data as json file, for later inspection
    var dateString = moment().format('YYYYMMDD_HHmm');
    var savedViewersFilename = "viewers_" + dateString + ".json";
    jsonfile.writeFile (__approot + "/saved/" + savedViewersFilename, viewers, function wroteJsonViewersFile () {
       winston.debug ("Saved viewers to json file: " + savedViewersFilename);
       // Delay the exit by a few millis to give the message time to be sent
       setTimeout (function () {
          process.exit ();
       }, 200);
    });
});
