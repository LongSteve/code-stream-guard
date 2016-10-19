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
   console.log ('New followers: ' + followers);
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
   console.log ('Unfollowed: ' + followers);
   followers.forEach (function (f) {
      chatter.sendMessage (strings.get ('chat-unfollowed', {'name': f}));
   });
});

// The joined event is emitted with a single nickname
chatter.on ('joined', function (nickname) {
   var isFollower = followers.isFollower(nickname);

   console.log ((isFollower ? 'Follower ': '') + nickname + ' joined the chat room');

   if (nickname !== 'longsteve') {

      chatter.sendMessage (strings.get (isFollower ? 'chat-welcome-follower' : 'chat-welcome-normal', {'name': nickname}));
   }

   if (socket) {
      var av = new Avatar ();
      av.requestImage (nickname, function requestImageCallback (error, image_url) {
         server.toClient (socket, 'new joiner', {
            'nickname': nickname,
            'image_url': image_url,
            'message': strings.get ('frontend-welcome', {'name': nickname}),
            'isFollower': isFollower
         });
      });
   }
});

// The left event is emitted with a single nickname
chatter.on ('left', function (nickname) {
   console.log (nickname + ' left the chat room');
});

// Someone has rated, send a message to the UI to display it
chatter.on ('rating', function (event) {
   if (socket) {
      server.toClient (socket, 'new rating', {'percent': event.rating});
   }
});

//
// Handle CTRL-C and send the goodbye message to the chat room
//
process.on ('SIGINT', function () {
    console.log ("Caught interrupt signal");
    if (chatter) {
       chatter.sendMessage (strings.get ('chat-bot-leaving'));
    }

    // Delay the exit by a few millis to give the message time to be sent
    setTimeout (function () {
       process.exit ();
    }, 200);
});
