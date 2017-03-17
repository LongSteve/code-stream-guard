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
var app = require('electron').app;                       // Module to control application life.
var BrowserWindow = require('electron').BrowserWindow;   // Module to create native browser window.

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

   var savedWindowFile = "main_window.json";
   jsonfile.readFile (__approot + "/saved/" + savedWindowFile, function readJsonWindowFile (error, windowData) {

      var defaultWindowWidth = 600;
      var defaultWindowHeight = 400;

      var windowMinWidth = 560;
      var windowMinHeight = 380;

      var usingSavedSettings = false;

      var winOpts = {
         'min-width': windowMinWidth,
         'min-height': windowMinHeight,
         'accept-first-mouse': true,
         'title-bar-style': 'hidden'
      };

      try {
         if (!error && windowData) {
            if (windowData.position && windowData.position.x) {
               winOpts.x = parseInt (windowData.position.x);
            }
            if (windowData.position && windowData.position.y) {
               winOpts.y = parseInt (windowData.position.y);
            }
            if (windowData.size && windowData.size.width) {
               winOpts.width = parseInt (windowData.size.width);
            }
            if (windowData.size && windowData.size.height) {
               winOpts.height = parseInt (windowData.size.height);
            }

            usingSavedSettings = true;
         }
      } catch (ex) {
         winston.error ("Error parsing main_window.json file.", ex);
         usingSavedSettings = false;
      }

      if (!usingSavedSettings) {
         winOpts.width = defaultWindowWidth;
         winOpts.height = defaultWindowHeight;

         // Determine the center of the primary monitor to display on
         var screen = require('electron').screen;  // Note, can only do this here after the app is ready
         var displays = screen.getAllDisplays ();
         // Default to the first screen
         var display = displays [0];
         winOpts.x = display.workArea.x + (display.workArea.width - defaultWindowWidth) / 2;
         winOpts.y = display.workArea.y + (display.workArea.height - defaultWindowHeight) / 2;
         // Now search for one with bounds.x and bounds.y at 0,0 for a primary display
         if (displays.length > 0) {
            for (var i in displays) {
               // Pick the display with the bounds.x and bounds.y at 0,0 for the primary monitor
               display = displays [i];
               if (display.bounds.x === 0 && display.bounds.y === 0) {
                  winOpts.x = display.workArea.x + (display.workArea.width - defaultWindowWidth) / 2;
                  winOpts.y = display.workArea.y + (display.workArea.height - defaultWindowHeight) / 2;
                  break;
               }
            }
         }
      }
      
      winston.info ("Main window location and size: " + winOpts.x + "," + winOpts.y + " " + winOpts.width + "x" + winOpts.height);

      mainWindow = new BrowserWindow (winOpts);

      mainWindow.loadURL ('http://localhost:3000/main.html');
      if (argv.debug) {
         mainWindow.webContents.openDevTools();
      }

      mainWindow.on ('close', function () {
         var pos = mainWindow.getPosition ();
         var sz = mainWindow.getSize ();
         var windowData = {
            "position": {
               "x": pos [0],
               "y": pos [1]
            },
            "size": {
               "width": sz [0],
               "height": sz [1]
            }
         };

         var savedWindowFile = "main_window.json";
         jsonfile.writeFile (__approot + "/saved/" + savedWindowFile, windowData, function wroteJsonWindowFile (error) {
            if (error) {
               winston.error ("Error saving main window data to json file: " + savedWindowFile, error);
            } else {
               winston.info("Saved main window data to json file: " + savedWindowFile);
            }
         });
      });

      mainWindow.on ('closed', function() {
         if (indicatorWindow) {
            indicatorWindow.close ();
            indicatorWindow = null;
         }
         mainWindow = null;
      });      
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

   if (data.action == "indicate" && data.name == "indicator" && indicatorWindow) {
      server.toClient ('indicate', {});
   }

   if (data.action == "button-move" && data.name == "indicator" && indicatorWindow) {
      var pos = indicatorWindow.getPosition ();
      var delta = data.data;
      if (delta && delta.length == 2) {
         pos [0] += delta [0];
         pos [1] += delta [1];

         indicatorWindow.setPosition (pos [0], pos [1]);
      }
   }
   
   if (data.action == "button-resize" && data.name == "indicator" && indicatorWindow) {
      var sz = indicatorWindow.getSize ();
      var delta = data.data;
      if (delta && delta.length == 2) {
         sz [0] += delta [0];
         sz [1] += delta [1];

         indicatorWindow.setSize (sz [0], sz [1]);
      }
   }

   if (data.action == "button-test" && data.name == "indicator" && indicatorWindow) {
      if (data.data == "rate") {
         server.toClient ('new rating', {'percent': 50});
      }
      if (data.data == "join") {
         server.toClient ('new joiner', {
            'nickname': "Tester",
            'image_url': 'https://www.livecoding.tv/static/img/userdashboard-img.png',
            'message': strings.get ('frontend-welcome', {'name': 'Tester'}),
            'isFollower': false
         });
      }
      if (data.data == "follow") {
         server.toClient ('new follower', {
            'nickname': "Tester",
            'image_url': 'https://www.livecoding.tv/static/img/userdashboard-img.png',
            'message': strings.get ('frontend-latest-follower', {'name': 'Tester'})
         });
      }
   }
      
   if (data.action == "show" && data.name == "indicator" && !indicatorWindow) {
      winston.verbose ("Request to show indicator window");

      var savedWindowFile = "indicator_window.json";
      jsonfile.readFile (__approot + "/saved/" + savedWindowFile, function readJsonWindowFile (error, windowData) {
        
         var defaultIndicatorWindowWidth = 240;
         var defaultIndicatorWindowHeight = 420;
         var usingSavedSettings = false;

         var winOpts = {
            resizable: true,
            show: false
         };

         try {
            if (!error && windowData) {
               if (windowData.position && windowData.position.x) {
                  winOpts.x = parseInt (windowData.position.x);
               }
               if (windowData.position && windowData.position.y) {
                  winOpts.y = parseInt (windowData.position.y);
               }
               if (windowData.size && windowData.size.width) {
                  winOpts.width = parseInt (windowData.size.width);
               }
               if (windowData.size && windowData.size.height) {
                  winOpts.height = parseInt (windowData.size.height);
               }
               usingSavedSettings = true;
            }
         } catch (ex) {
            winston.error ("Error parsing indicator_window.json file.", ex);
            usingSavedSettings = false;
         }
                                                                     
         if (data.transparent) {
            winOpts.frame = false;
            winOpts.transparent = true;
         } else {
            winOpts.backgroundColor ="#FFFFFF";
         }

         if (!usingSavedSettings) {
            winOpts.width = defaultIndicatorWindowWidth;
            winOpts.height = defaultIndicatorWindowHeight;

            var mainWindowPos = mainWindow.getPosition ();
            var mainWindowSize = mainWindow.getSize ();
            winOpts.x = mainWindowPos [0] + mainWindowSize [0];
            winOpts.y = mainWindowPos [1] + mainWindowSize [1] - winOpts.height;
         }

         winston.info ("Opening indicator window, location and size: " + winOpts.x + "," + winOpts.y + " " + winOpts.width + "x" + winOpts.height);

         // Create the browser window.
         indicatorWindow = new BrowserWindow (winOpts);

         // and load the index.html of the app.
         indicatorWindow.loadURL('http://localhost:3000/indicator.html');
         //indicatorWindow.webContents.openDevTools ();

         indicatorWindow.on ('ready-to-show', function () {
            indicatorWindow.show ();
            winston.verbose ("Indicator window shown");
            server.toClient ("window", {"name": "indicator", "event": "show"}, _socket);

            var pos = indicatorWindow.getPosition ();
            var sz = indicatorWindow.getSize ();
            server.toClient ("window", {"name": "indicator", "event": "move", "data": pos}, _socket);
            server.toClient ("window", {"name": "indicator", "event": "resize", "data": sz}, _socket);
         });

         indicatorWindow.on ('close', function () {
            var pos = indicatorWindow.getPosition ();
            var sz = indicatorWindow.getSize ();

            var windowData = {
               "position": {
                  "x": pos [0],
                  "y": pos [1]
               },
               "size": {
                  "width": sz [0],
                  "height": sz [1]
               }
            };

            var savedWindowFile = "indicator_window.json";
            jsonfile.writeFile (__approot + "/saved/" + savedWindowFile, windowData, function wroteJsonWindowFile (error) {
               if (error) {
                  winston.error ("Error saving indicator window data to json file: " + savedWindowFile, error);
               } else {
                  winston.info("Saved indicator window data to json file: " + savedWindowFile);
               }
            });
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

         indicatorWindow.on ('move', function () {
            var pos = indicatorWindow.getPosition ();
            server.toClient ("window", {"name": "indicator", "event": "move", "data": pos}, _socket);
         });

         indicatorWindow.on ('resize', function () {
            var sz = indicatorWindow.getSize ();
            server.toClient ("window", {"name": "indicator", "event": "resize", "data": sz}, _socket);
         });

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
