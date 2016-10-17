//
// Chat bot module
//

var _ = require ('lodash');

var fs = require ('fs');
var util = require ('util');

var EventEmitter = require ('events').EventEmitter;

var xmppbot = require ('./bot-xmpp');
var config = require ('./config.js');

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
//   !vote
//   !rate (!rating)
//

var Chatter = function Chatter () {
   var self = this;

   var username = config.nickname.substring (0, config.nickname.indexOf ('@'));
   var channel = config.channel;

   var commands = {};

   var helpmessage = 'You can use the following commands:\n' +
                     '  !help   - Show this help\n';

   var bot = new xmppbot (config);

   //
   // Load the set of dynamic commands from the commands folder
   //
   fs.readdirSync (__dirname + '/commands/').forEach (function (file) {
      if (file.match (/.+\.js/g) !== null) {
         var name = file.replace ('.js', '');
         commands [name] = require ('./commands/' + file);

         commands [name].init (self, bot);
         console.log ('Loaded the ' + name + ' chatter module.');
         var helpstring = '  !' + commands [name].name + ' ' + commands [name].args;
         helpstring = _.padEnd (helpstring, 10);
         helpstring += '- ' + commands [name].help + "\n";

         helpmessage += helpstring;
      }
   });

   bot.on( 'command!help', function (channel, text, nickname, stanza) {
      bot.message (channel, helpmessage);
   });

   bot.on ('online', function (data) {
      console.log ('Joining the ' + channel + ' channel as ' + username);
      bot.join (channel, username);
   });

   bot.on ('error', function (e) {
      console.error ('error...');
      console.error (e);
   });

   bot.on( 'msg', function (nickname, _channel, message, stanza) {
      //console.log (nickname + ' said "' + message + '" in ' + _channel );
   });

   bot.on( 'join', function (_channel, nickname, stanza) {
      //console.log (nickname + ' has joined channel ' + _channel);

      // When the bot joins the room, issue the help message
      if (nickname === username) {
         bot.message (channel, "Hi everyone, I'm tim the chat bot.");
         bot.message (channel, helpmessage);
      } else {
         // Emit the joined event for all other users
         self.emit ('joined', nickname);
      }
   });

   bot.on( 'part', function (_channel, nickname, stanza) {
      //console.log (nickname + ' has left channel ' + _channel);
      self.emit ('left', nickname);
   });

   self.getChannel = function getChannel () {
      return channel;
   };

   self.getUsername = function getUsername () {
      return username;
   };

   self.sendMessage = function sendMessage (message) {
      bot.message (channel, message);
   };
};

util.inherits (Chatter, EventEmitter);

module.exports = exports = new Chatter ();
