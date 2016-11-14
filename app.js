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
// readdirp for reading and loading plugin files recursively
//
var readdirp = require ('readdirp');

//
// Async cause I've used it for so long now
//
var async = require ('async');
  
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

app.on ('before-quit', function() {
    quit ();
})

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
var followers = require (__approot + '/modules/followers.js');

//
// Kick off the chat bot connection to the XMPP chat
//
var chatter = require (__approot + '/modules/chatter.js');

//
// Load and init all plugins
//
var plugins = [];

//
// readdirp recurses down directories
//
readdirp ({ root: __approot + '/plugins', fileFilter: [ '*.js'] }, 

   function (entry) { 
      var name = entry.name.replace ('.js', '');
      winston.verbose ("Loading plugin: " + name);
      var p = require (entry.fullPath);
      p.name = name;
      plugins.push (p);
   },

   function (error, files) {
   
      if (error) {
         winston.error ("Error reading plugin files: " + error);
         process.exit (1);
      }

      winston.verbose ("Initialising " + plugins.length  + " plugins");

      async.each (plugins, 
         function (plugin, cb) {
            // do something with each JavaScript file entry
            winston.info ("Initialising plugin: " + plugin.name);
            plugin.init (cb);
         },

         function (error) {
            if (error) {
               winston.error ("Error initialising plugin file: " + error);
               process.exit (1);
            }

            winston.verbose ("All plugins loaded");
         }
      );
   });

//
// Terminate the plugins at app exit
//
function quit () {

   if (chatter) {
      chatter.sendMessage (strings.get ('chat-bot-leaving'));
   }

   async.each (plugins, 
      function (plugin, cb) {
         winston.info ("Terminating plugin: " + plugin.name);
         plugin.term (cb);
      },

      function (error) {
         if (error) {
            winston.error ("Error terminating plugin file: " + error);
            process.exit (1);
         }
         process.exit (0);
      }
   );
}

//
// Handle CTRL-C to quit, although this doesn't get triggered when running under Electron
//
process.on ('SIGINT', function () {
    winston.info ("Caught interrupt signal, exiting");
    quit ();
});
